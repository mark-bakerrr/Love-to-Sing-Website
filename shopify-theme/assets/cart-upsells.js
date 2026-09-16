/**
 * Cart drawer upsells — one-tap add for the recommended products in the extras
 * rail. Delegated on document so it survives the cart drawer body re-rendering
 * (cart-drawer.js replaces #CartDrawer-Body on cart:reload). After a successful
 * add it asks the theme to refresh + open the drawer, matching the rest of the
 * cart flow (cart-drawer.js listens for these events).
 */
(function () {
  function addToCart(variantId) {
    return fetch("/cart/add.js", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ items: [{ id: Number(variantId), quantity: 1 }] }),
    }).then(function (r) {
      if (!r.ok) throw new Error("cart/add " + r.status);
      return r.json();
    });
  }

  document.addEventListener("click", function (event) {
    var btn = event.target.closest ? event.target.closest("[data-cart-upsell-add]") : null;
    if (!btn) return;
    event.preventDefault();

    var variantId = btn.getAttribute("data-variant-id");
    if (!variantId || btn.classList.contains("is-loading")) return;

    btn.classList.add("is-loading");
    addToCart(variantId)
      .then(function () {
        btn.classList.remove("is-loading");
        btn.classList.add("is-added");
        document.dispatchEvent(new CustomEvent("cart:reload", { bubbles: true }));
        document.dispatchEvent(new CustomEvent("cart:open", { bubbles: true }));
      })
      .catch(function (err) {
        console.warn("[cart-upsells] add failed", err);
        btn.classList.remove("is-loading");
        btn.classList.add("is-error");
        window.setTimeout(function () { btn.classList.remove("is-error"); }, 1800);
      });
  });
})();
