import Link from "next/link";
import { ArrowRight, Star } from "lucide-react";
import type { Title, CatalogPage, Result } from "@/lib/catalog/types";
import { SaveButton } from "@/components/library/controls";
import { Artwork } from "./artwork";
export function TitleCard({ title }: { title: Title }) {
  return (
    <article className="story-card">
      <div className="story-cover">
        <Link
          prefetch={false}
          href={`/${title.medium}/${title.id}`}
          aria-label={`Explore ${title.title}`}
        >
          <Artwork src={title.image} alt={title.title} />
          <span className="card-explore">
            Enter this story <ArrowRight size={17} />
          </span>
        </Link>
        <span className="format-badge">{title.format ?? title.medium}</span>
        <SaveButton title={title} />
        {title.score !== null && (
          <span className="score-badge">
            <Star size={11} fill="currentColor" />
            {title.score.toFixed(2)}
          </span>
        )}
      </div>
      <div className="story-meta">
        <div>
          <h3>
            <Link prefetch={false} href={`/${title.medium}/${title.id}`}>
              {title.title}
            </Link>
          </h3>
          <p>
            {title.genres[0]?.name ?? title.format ?? title.medium}
            {title.year && <span>· {title.year}</span>}
            {title.episodes && <span>· {title.episodes} eps</span>}
          </p>
        </div>
      </div>
    </article>
  );
}
export function TitleGrid({
  items,
  compact = false,
}: {
  items: Title[];
  compact?: boolean;
}) {
  return items.length ? (
    <div className={`catalog-grid ${compact ? "compact-grid" : ""}`}>
      {items.map((title) => (
        <TitleCard key={`${title.medium}/${title.id}`} title={title} />
      ))}
    </div>
  ) : (
    <div className="empty-state">
      <h3>No stories here yet.</h3>
      <p>Try a broader search or another filter.</p>
      <Link className="text-action" href="/discover">
        Explore the archive <ArrowRight size={16} />
      </Link>
    </div>
  );
}
export function ServiceMessage({ error }: { error: string }) {
  return (
    <div className="service-message" role="status">
      <span>THE ARCHIVE IS TAKING A BREATH</span>
      <h3>
        {error === "rate-limited"
          ? "A little pause between stories."
          : "This shelf is temporarily unavailable."}
      </h3>
      <p>
        {error === "rate-limited"
          ? "Our data provider is busy. Please try again in a minute."
          : "Your library is safe. Try another shelf, or reload this page shortly."}
      </p>
      <Link href="/library">Visit your library ↗</Link>
    </div>
  );
}
export function SourceNote({ source }: { source: string }) {
  return (
    <p className="source-note">
      Community data via{" "}
      {source === "RapidAPI" ? "MyAnimeList · RapidAPI" : "Jikan · MyAnimeList"}
      . Scores and availability can change.
    </p>
  );
}
export function SectionTitle({
  eyebrow,
  title,
  href,
  action = "Explore shelf",
}: {
  eyebrow: string;
  title: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="section-heading">
      <div>
        <p className="eyebrow coral">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      {href && (
        <Link className="text-action" href={href}>
          {action} <ArrowRight size={16} />
        </Link>
      )}
    </div>
  );
}
export function Pagination({
  page,
  hasNext,
  pathname,
  params = {},
}: {
  page: number;
  hasNext: boolean;
  pathname: string;
  params?: Record<string, string>;
}) {
  const href = (p: number) =>
    `${pathname}?${new URLSearchParams({ ...params, page: String(p) })}`;
  return (
    <nav className="pagination" aria-label="Result pages">
      {page > 1 ? <Link href={href(page - 1)}>← Previous</Link> : <span />}
      <span>Page {page}</span>
      {hasNext ? <Link href={href(page + 1)}>Next →</Link> : <span />}
    </nav>
  );
}
export function CatalogResult({ result }: { result: Result<CatalogPage> }) {
  return result.data ? (
    <>
      <TitleGrid items={result.data.items} />
      <SourceNote source={result.source} />
    </>
  ) : (
    <ServiceMessage error={result.error} />
  );
}
