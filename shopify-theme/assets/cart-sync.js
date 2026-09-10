/**
 * Cart sync — keeps the theme's standard cart drawer + header count in sync with
 * cart mutations made by surfaces that DON'T fire the theme's own cart events.
 *
 * The "Get the music" CTA on product pages opens a third-party Shop Drawer app
 * embed. When that app adds an item via the Ajax Cart API it doesn't dispatch
 * the theme's `cart:reload`, so our cart-drawer body (rendered empty at page
 * load) stayed stale until a full /cart page load.
 *
 * This wraps fetch + XHR and, on any successful cart-mutating request, fires a
 * debounced `cart:refresh` (cart-drawer.js re-renders contents + the header
 * count bubble WITHOUT popping the drawer open). Works for any app/script that
 * uses the standard /cart/{add,change,update,clear} endpoints.
 */
(function () {
  var CART_MUTATION = /\/cart\/(add|change|update|clear)(\.js)?(\?|$)/i;
  var timer = null;

  function scheduleRefresh() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () {
      document.dispatchEvent(new CustomEvent('cart:refresh', { bubbles: true }));
    }, 150);
  }

  // ── fetch ──────────────────────────────────────────────────────────────
  if (typeof window.fetch === 'function') {
    var origFetch = window.fetch;
    window.fetch = function () {
      var input = arguments[0];
      var url = input && typeof input === 'object' && 'url' in input ? input.url : input;
      var isCart = typeof url === 'string' && CART_MUTATION.test(url);
      var result = origFetch.apply(this, arguments);
      if (isCart && result && typeof result.then === 'function') {
        result.then(function (res) {
          if (res && res.ok) scheduleRefresh();
        }).catch(function () {});
      }
      return result;
    };
  }

  // ── XMLHttpRequest (some apps still use it) ──────────────────────────────
  var origOpen = XMLHttpRequest.prototype.open;
  var origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__ltsCartMutation = typeof url === 'string' && CART_MUTATION.test(url);
    return origOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function () {
    if (this.__ltsCartMutation) {
      this.addEventListener('load', function () {
        if (this.status >= 200 && this.status < 300) scheduleRefresh();
      });
    }
    return origSend.apply(this, arguments);
  };
})();
