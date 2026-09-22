import Link from "next/link";
export default function NotFound() {
  return (
    <div className="page-width platform-page empty-state">
      <p className="eyebrow coral">404 / A PATH LESS TRAVELLED</p>
      <h1>This story isn’t here.</h1>
      <p>
        The link may be incomplete, or the title is no longer in the archive.
      </p>
      <Link className="primary-action" href="/discover">
        Find another story ↗
      </Link>
    </div>
  );
}
