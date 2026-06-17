(function () {
  const grid = document.querySelector('[data-blog-all-grid]');
  const sentinel = document.querySelector('[data-blog-all-sentinel]');
  const loading = document.querySelector('[data-blog-all-loading]');

  if (!grid || !sentinel) return;

  let fetching = false;

  const observer = new IntersectionObserver(
    (entries) => {
      const entry = entries[0];
      if (!entry.isIntersecting || fetching) return;

      const nextUrl = sentinel.dataset.next;
      if (!nextUrl) {
        observer.disconnect();
        sentinel.remove();
        return;
      }

      fetching = true;
      if (loading) loading.style.display = '';

      fetch(nextUrl)
        .then((res) => res.text())
        .then((html) => {
          const doc = new DOMParser().parseFromString(html, 'text/html');
          const newItems = doc.querySelectorAll('[data-blog-all-grid] > *');
          newItems.forEach((el) => grid.appendChild(el));

          const newSentinel = doc.querySelector('[data-blog-all-sentinel]');
          if (newSentinel && newSentinel.dataset.next) {
            sentinel.dataset.next = newSentinel.dataset.next;
          } else {
            observer.disconnect();
            sentinel.remove();
          }
        })
        .catch((err) => console.error('Infinite scroll error:', err))
        .finally(() => {
          fetching = false;
          if (loading) loading.style.display = 'none';
        });
    },
    { rootMargin: '200px' }
  );

  observer.observe(sentinel);
})();
