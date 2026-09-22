export default function Loading() {
  return (
    <div
      className="page-width platform-page"
      role="status"
      aria-label="Loading stories"
    >
      <div className="skeleton-title" />
      <div className="catalog-grid">
        {Array.from({ length: 12 }, (_, i) => (
          <div className="skeleton-card" key={i} />
        ))}
      </div>
      <span className="sr-only">Opening the next chapter…</span>
    </div>
  );
}
