(function () {
  "use strict";

  var script = document.currentScript;
  if (!script) return;

  // ─── Supabase config (from shop metafields via theme extension) ───
  var SUPABASE_URL = script.getAttribute("data-supabase-url");
  var SUPABASE_KEY = script.getAttribute("data-supabase-key");
  var ARTICLE_ID = script.getAttribute("data-article-id") || "";
  var HEADER_BLOCK = script.getAttribute("data-header-block");
  var FOOTER_BLOCK = script.getAttribute("data-footer-block");
  var SIDEBAR_BLOCK = script.getAttribute("data-sidebar-block");

  // Bail if Supabase config is missing
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn("[LTS Blocks] Missing Supabase config — blocks disabled.");
    return;
  }

  // ─── API helpers (Supabase Edge Functions) ────────────────────────

  function fetchBlock(id) {
    return fetch(SUPABASE_URL + "/functions/v1/block-get?id=" + encodeURIComponent(id), {
      headers: { "apikey": SUPABASE_KEY }
    }).then(function (res) {
      if (!res.ok) return null;
      return res.json();
    }).catch(function () { return null; });
  }

  function submitEmail(blockId, email, metadata) {
    var body = { blockId: blockId, email: email, articleId: ARTICLE_ID };
    if (metadata) body.metadata = metadata;

    return fetch(SUPABASE_URL + "/functions/v1/block-submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY
      },
      body: JSON.stringify(body)
    }).then(function (res) { return res.json(); });
  }

  function track(blockId, event) {
    // Use sendBeacon with JSON for fire-and-forget analytics
    var body = JSON.stringify({ blockId: blockId, event: event, articleId: ARTICLE_ID });
    var blob = new Blob([body], { type: "application/json" });

    // sendBeacon doesn't support custom headers, so fall back to fetch for apikey auth
    fetch(SUPABASE_URL + "/functions/v1/block-track", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY
      },
      body: body,
      keepalive: true
    }).catch(function () { /* analytics is best-effort */ });
  }

  // ─── HTML escaping ────────────────────────────────────────────────

  function esc(str) {
    var div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
  }

  // ─── Custom background helper ────────────────────────────────────
  function customBgAttr(config) {
    var c = config || {};
    if (!c.customBgType || c.customBgType === "none" || !c.customBgValue) return "";
    return ' style="background: ' + esc(c.customBgValue) + ' !important;"';
  }

  // ─── Block renderers (one per block type) ─────────────────────────

  var renderers = {
    printable: function (b) {
      var c = b.config;
      var thumb = c.thumbnailUrl
        ? '<img src="' + esc(c.thumbnailUrl) + '" alt="' + esc(b.headline) + '" class="lts-printable-img">'
        : '<div class="lts-thumb-placeholder">\uD83D\uDCC4</div>';
      return '<div class="lts-block lts-printable"' + customBgAttr(c) + '>'
        + '<div class="lts-printable-thumb">' + thumb + '</div>'
        + '<div class="lts-printable-content">'
        + '<h3 class="lts-heading">' + esc(b.headline) + '</h3>'
        + (b.description ? '<p class="lts-desc">' + esc(b.description) + '</p>' : '')
        + '<form class="lts-form" data-block-id="' + b.id + '">'
        + '<input type="email" class="lts-input" placeholder="Enter your email" required>'
        + '<button type="submit" class="lts-btn">' + esc(c.ctaText || "Get My Free Download") + '</button>'
        + '</form>'
        + '<p class="lts-trust">\uD83D\uDD12 ' + esc(c.trustLine || "We'll never spam you. Unsubscribe anytime.") + '</p>'
        + '</div></div>';
    },

    newsletter: function (b) {
      var c = b.config;
      return '<div class="lts-block lts-newsletter"' + customBgAttr(c) + '>'
        + '<div class="lts-newsletter-icon">\u266A</div>'
        + '<h3 class="lts-heading">' + esc(b.headline) + '</h3>'
        + '<p class="lts-sub">' + esc(c.subtext || "") + '</p>'
        + '<form class="lts-form" data-block-id="' + b.id + '">'
        + '<input type="email" class="lts-input" placeholder="Enter your email address" required>'
        + '<button type="submit" class="lts-btn">' + esc(c.ctaText || "Subscribe") + '</button>'
        + '</form></div>';
    },

    guide: function (b) {
      var c = b.config;
      var cover = c.coverImageUrl
        ? '<img src="' + esc(c.coverImageUrl) + '" alt="' + esc(b.headline) + '" class="lts-guide-img">'
        : '<div class="lts-book-placeholder">\uD83D\uDCDA</div>';
      var bullets = (c.bullets || []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('');
      return '<div class="lts-block lts-guide"' + customBgAttr(c) + '>'
        + '<div class="lts-guide-book">' + cover + '</div>'
        + '<div class="lts-guide-content">'
        + '<span class="lts-badge">' + esc(c.badgeText || "FREE GUIDE") + '</span>'
        + '<h3 class="lts-heading">' + esc(b.headline) + '</h3>'
        + '<ul class="lts-bullets">' + bullets + '</ul>'
        + '<form class="lts-form" data-block-id="' + b.id + '">'
        + '<input type="email" class="lts-input" placeholder="Enter your email" required>'
        + '<button type="submit" class="lts-btn">' + esc(c.ctaText || "Download Free Guide") + '</button>'
        + '</form></div></div>';
    },

    quiz: function (b) {
      var c = b.config;
      var opts = (c.options || []).map(function (o) {
        return '<button type="button" class="lts-quiz-option" data-answer="' + esc(o.label) + '">'
          + '<span class="lts-emoji">' + esc(o.emoji) + '</span>'
          + '<span>' + esc(o.label) + '</span></button>';
      }).join('');
      return '<div class="lts-block lts-quiz"' + customBgAttr(c) + '>'
        + '<div class="lts-quiz-header">'
        + '<h3 class="lts-heading">' + esc(b.headline) + '</h3>'
        + '<p class="lts-quiz-sub">' + esc(c.subtitle || "") + '</p></div>'
        + '<div class="lts-quiz-body">'
        + '<div class="lts-quiz-grid">' + opts + '</div>'
        + '<div class="lts-quiz-capture" style="display:none">'
        + '<p>' + esc(c.captureText || "Enter your email to see your result") + '</p>'
        + '<form class="lts-form" data-block-id="' + b.id + '">'
        + '<input type="email" class="lts-input" placeholder="Your email" required>'
        + '<button type="submit" class="lts-btn">' + esc(c.ctaText || "Reveal My Result") + '</button>'
        + '</form></div>'
        + '<div class="lts-quiz-result" style="display:none"></div>'
        + '</div></div>';
    },

    related_posts: function (b) {
      var c = b.config;
      return '<div class="lts-block lts-related"' + customBgAttr(c) + '>'
        + '<h3 class="lts-heading">\u2764\uFE0F ' + esc(c.heading || "You Might Also Love") + '</h3>'
        + '<div class="lts-related-grid" data-block-id="' + b.id + '" data-max="' + (c.maxPosts || 3) + '">'
        + '<p class="lts-loading">Loading recommendations...</p>'
        + '</div></div>';
    },

    inline_upgrade: function (b) {
      var c = b.config;
      return '<div class="lts-block lts-inline-upgrade"' + customBgAttr(c) + '>'
        + '<p class="lts-upgrade-copy">' + esc(c.copyText) + '</p>'
        + '<form class="lts-form lts-form-inline" data-block-id="' + b.id + '">'
        + '<input type="email" class="lts-input" placeholder="Your email" required>'
        + '<button type="submit" class="lts-btn lts-btn-link">' + esc(c.ctaText || "Send it to me \u2192") + '</button>'
        + '</form></div>';
    }
  };

  // ─── Thank you state renderer ─────────────────────────────────────

  function renderThankYou(container, block, result) {
    var c = block.config;
    var thankYouMsg = result.thankYouMessage || c.thankYouMessage || "Thanks! You're all set.";
    var errorMsg = c.errorMessage || "Something went wrong. Please try again.";

    var html = '<div class="lts-block lts-thank-you">'
      + '<div class="lts-thank-you-icon">\u2705</div>'
      + '<p class="lts-thank-you-msg">' + esc(thankYouMsg) + '</p>';

    // Show download button if there's a download URL
    if (result.downloadUrl) {
      var btnText = result.downloadButtonText || c.downloadButtonText || "Download Now";
      html += '<a href="' + esc(result.downloadUrl) + '" target="_blank" rel="noopener" class="lts-btn lts-download-btn">'
        + esc(btnText) + '</a>';
    }

    html += '</div>';

    // Replace form area with thank you message (keep the outer block wrapper)
    var form = container.querySelector(".lts-form");
    if (form) {
      var thankYouEl = document.createElement("div");
      thankYouEl.innerHTML = html;
      form.parentNode.replaceChild(thankYouEl, form);
      // Also hide trust line if present
      var trust = container.querySelector(".lts-trust");
      if (trust) trust.style.display = "none";
    }
  }

  // ─── Render a block into a container + attach event handlers ──────

  function renderBlock(container, block) {
    var renderer = renderers[block.type];
    if (!renderer) return;
    container.innerHTML = renderer(block);
    track(block.id, "impression");

    // Form submit handler
    var form = container.querySelector(".lts-form");
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var input = form.querySelector("input[type=email]");
        var btn = form.querySelector("button[type=submit]");
        var email = input.value;
        btn.textContent = "Sending...";
        btn.disabled = true;

        var selectedOpt = container.querySelector(".lts-quiz-option.selected");
        var metadata = selectedOpt ? { answer: selectedOpt.getAttribute("data-answer") } : null;

        submitEmail(block.id, email, metadata).then(function (result) {
          track(block.id, "submit");

          if (result.resultText) {
            // Quiz result — show result text, then thank you
            var resultDiv = container.querySelector(".lts-quiz-result");
            if (resultDiv) {
              resultDiv.innerHTML = '<p class="lts-result-text">' + esc(result.resultText) + '</p>';
              resultDiv.style.display = "block";
              var cap = container.querySelector(".lts-quiz-capture");
              if (cap) cap.style.display = "none";
            }
          } else {
            // All other block types — show inline thank you
            renderThankYou(container, block, result);
          }
        }).catch(function () {
          var errorMsg = block.config.errorMessage || "Something went wrong. Please try again.";
          btn.textContent = errorMsg;
          btn.disabled = false;
          // Reset button text after a few seconds
          setTimeout(function () {
            btn.textContent = block.config.ctaText || "Try again";
          }, 3000);
        });
      });
    }

    // Quiz option click handlers
    var quizOpts = container.querySelectorAll(".lts-quiz-option");
    quizOpts.forEach(function (opt) {
      opt.addEventListener("click", function () {
        quizOpts.forEach(function (o) { o.classList.remove("selected"); });
        opt.classList.add("selected");
        var capture = container.querySelector(".lts-quiz-capture");
        if (capture) capture.style.display = "block";
        track(block.id, "quiz_start");
      });
    });
  }

  // ─── Init: find article body, inject fixed blocks + scan shortcodes ─

  function init() {
    // Find article content container (Dawn theme + common selectors)
    var articleBody = document.querySelector(
      ".article-template__content, .article__content, .article-template__body, [data-article-content], .rte"
    );
    console.log("[LTS Blocks] init — articleBody:", articleBody ? articleBody.className : "NOT FOUND");
    if (!articleBody) return;

    // 1. Fixed-position blocks from article metafields
    if (HEADER_BLOCK) {
      fetchBlock(HEADER_BLOCK).then(function (block) {
        if (!block) return;
        var el = document.createElement("div");
        el.className = "lts-fixed-block lts-position-header";
        articleBody.parentNode.insertBefore(el, articleBody);
        renderBlock(el, block);
      });
    }

    if (FOOTER_BLOCK) {
      fetchBlock(FOOTER_BLOCK).then(function (block) {
        if (!block) return;
        var el = document.createElement("div");
        el.className = "lts-fixed-block lts-position-footer";
        articleBody.parentNode.insertBefore(el, articleBody.nextSibling);
        renderBlock(el, block);
      });
    }

    // 2. Fill placeholders created by the early inline script.
    //    The inline script already swapped [lts:ID] text for
    //    <div class="lts-placeholder" data-block-id="ID"></div>
    //    so we just fetch & render into those containers.
    var placeholders = articleBody.querySelectorAll(".lts-placeholder[data-block-id]");
    console.log("[LTS Blocks] placeholders found:", placeholders.length);

    placeholders.forEach(function (ph) {
      var blockId = ph.getAttribute("data-block-id");
      console.log("[LTS Blocks] filling placeholder for block:", blockId);
      fetchBlock(blockId).then(function (block) {
        console.log("[LTS Blocks] fetchBlock result:", block ? block.type : "null");
        if (!block) { ph.remove(); return; }
        ph.classList.remove("lts-placeholder");
        renderBlock(ph, block);
      });
    });

    // Fallback: scan for any shortcodes the early script may have missed
    // (e.g. content loaded after DOMContentLoaded via JS)
    var walker = document.createTreeWalker(articleBody, NodeFilter.SHOW_TEXT);
    var regex = /\[lts:([a-zA-Z0-9_-]+)\]/g;
    var replacements = [];

    while (walker.nextNode()) {
      var node = walker.currentNode;
      var match;
      regex.lastIndex = 0;
      while ((match = regex.exec(node.textContent)) !== null) {
        replacements.push({ node: node, fullMatch: match[0], blockId: match[1] });
      }
    }

    console.log("[LTS Blocks] fallback shortcodes found:", replacements.length);
    replacements.reverse().forEach(function (r) {
      console.log("[LTS Blocks] fallback processing:", r.blockId);
      fetchBlock(r.blockId).then(function (block) {
        console.log("[LTS Blocks] fallback fetchBlock:", block ? block.type : "null");
        if (!block) return;
        var container = document.createElement("div");
        container.className = "lts-inline-block";

        var parts = r.node.textContent.split(r.fullMatch);
        var before = document.createTextNode(parts[0]);
        var after = document.createTextNode(parts.slice(1).join(r.fullMatch));

        r.node.parentNode.insertBefore(before, r.node);
        r.node.parentNode.insertBefore(container, r.node);
        r.node.parentNode.insertBefore(after, r.node);
        r.node.parentNode.removeChild(r.node);

        renderBlock(container, block);
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
