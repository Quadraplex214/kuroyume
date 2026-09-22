import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getDetail,
  getRecommendations,
  getCharacters,
} from "@/lib/catalog/service";
import { positiveId } from "@/lib/catalog/normalize";
import {
  ServiceMessage,
  TitleGrid,
  SourceNote,
  SectionTitle,
} from "@/components/catalog/cards";
import { Artwork } from "@/components/catalog/artwork";
import { Tracker } from "@/components/library/controls";
import type { Medium } from "@/lib/catalog/types";
export type DetailParams = Promise<{ id: string }>;
export async function titleMetadata(
  params: DetailParams,
  medium: Medium,
): Promise<Metadata> {
  const { id } = await params;
  const numericId = positiveId(id);
  if (!numericId) return { title: "Story not found" };
  const result = await getDetail(medium, numericId);
  if (!result.data) return { title: "Story unavailable" };
  const title = result.data;
  return {
    title: title.title,
    description: title.synopsis.slice(0, 160),
    openGraph: {
      title: `${title.title} | Kuroyume`,
      description: title.synopsis.slice(0, 160),
      images: title.image ? [{ url: title.image, alt: title.title }] : [],
    },
  };
}
async function Recommendations({ medium, id }: { medium: Medium; id: number }) {
  const result = await getRecommendations(medium, id);
  return (
    <section id="recommendations" className="detail-section">
      <SectionTitle
        eyebrow="THE NEXT THREAD"
        title="If this stays with you…"
        href={`/recommendations?medium=${medium}&id=${id}`}
        action="Follow the trail"
      />
      {result.data ? (
        <TitleGrid items={result.data.slice(0, 6)} compact />
      ) : (
        <ServiceMessage error={result.error} />
      )}
    </section>
  );
}
async function Characters({ medium, id }: { medium: Medium; id: number }) {
  const result = await getCharacters(medium, id);
  return (
    <section id="characters" className="detail-section">
      <SectionTitle
        eyebrow="THE PEOPLE WITHIN THE PAGES"
        title="Meet the characters"
      />
      {result.data?.length ? (
        <div className="people-grid">
          {result.data.map((c) => (
            <Link
              href={`/character/${c.id}`}
              key={c.id}
              className="person-card"
              prefetch={false}
            >
              <div>
                <Artwork src={c.image} alt={c.name} sizes="100px" />
              </div>
              <h3>{c.name}</h3>
              <p>{c.role}</p>
            </Link>
          ))}
        </div>
      ) : result.error ? (
        <ServiceMessage error={result.error} />
      ) : (
        <p className="small-note">
          Character information is not available for this title yet.
        </p>
      )}
    </section>
  );
}
export async function DetailPage({
  params,
  medium,
}: {
  params: DetailParams;
  medium: Medium;
}) {
  const { id } = await params;
  const numericId = positiveId(id);
  if (!numericId) notFound();
  const result = await getDetail(medium, numericId);
  if (result.error === "not-found") notFound();
  if (!result.data)
    return (
      <div className="page-width platform-page">
        <ServiceMessage error={result.error} />
      </div>
    );
  const t = result.data;
  return (
    <div className="detail-page">
      <div className="detail-atmosphere" aria-hidden="true" />
      <div className="page-width">
        <nav className="breadcrumbs">
          <Link href={`/${medium}`}>
            {medium === "anime"
              ? "Anime"
              : t.format === "Manhwa"
                ? "Manga / Manhwa"
                : "Manga"}
          </Link>
          <span>/</span>
          <span>{t.title}</span>
        </nav>
        <section className="detail-hero">
          <div className="detail-cover">
            <Artwork
              src={t.image}
              alt={t.title}
              eager
              sizes="(max-width:600px) 180px,300px"
            />
          </div>
          <div className="detail-heading">
            <p className="eyebrow coral">
              {t.format ?? medium}{" "}
              <span>/ {t.status ?? "A story waiting to be discovered"}</span>
            </p>
            <h1>{t.title}</h1>
            <p className="alternative-title">
              {t.alternativeTitles.find((n) => n !== t.title)}
            </p>
            <div className="detail-metrics">
              {[
                [t.score?.toFixed(2) ?? "—", "MAL score"],
                [t.rank ? `#${t.rank}` : "—", "Community rank"],
                [
                  t.members
                    ? Intl.NumberFormat("en", { notation: "compact" }).format(
                        t.members,
                      )
                    : "—",
                  "MAL members",
                ],
              ].map(([value, label]) => (
                <div key={label}>
                  <strong>{value}</strong>
                  <span>{label}</span>
                </div>
              ))}
            </div>
            <div className="genre-tags">
              {t.genres.map((g) => (
                <Link
                  key={g.id}
                  href={`/discover?medium=${medium}&genre=${g.id}`}
                >
                  {g.name}
                </Link>
              ))}
            </div>
            <div className="detail-quick-links">
              {t.trailer && (
                <a href={t.trailer} target="_blank" rel="noreferrer">
                  ▷ Watch trailer on YouTube ↗
                </a>
              )}
              <a
                href={`https://myanimelist.net/${medium}/${t.id}`}
                target="_blank"
                rel="noreferrer"
              >
                MyAnimeList ↗
              </a>
            </div>
          </div>
        </section>
        <nav className="detail-nav">
          <a href="#overview">The story</a>
          <a href="#connections">Connections</a>
          <a href="#characters">Characters</a>
          <a href="#recommendations">Similar stories</a>
        </nav>
        <div className="detail-columns">
          <div>
            <section id="overview" className="detail-section">
              <p className="eyebrow coral">BEFORE YOU BEGIN</p>
              <h2>The story</h2>
              <p className="synopsis">
                {t.synopsis ||
                  "A synopsis is not available for this title yet."}
              </p>
              <dl className="facts-grid">
                {Object.entries(t.facts)
                  .filter(
                    ([key]) =>
                      ![
                        "synopsis",
                        "genre",
                        "theme",
                        "genres",
                        "demographic",
                      ].includes(key),
                  )
                  .map(([key, value]) => (
                    <div key={key}>
                      <dt>{key.replaceAll("_", " ")}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
              </dl>
              {t.studios.length > 0 && (
                <div className="studio-links">
                  <p className="eyebrow">THE HANDS BEHIND THE STORY</p>
                  {t.studios.map((s) => (
                    <Link key={s.id} href={`/studio/${s.id}`}>
                      {s.name} ↗
                    </Link>
                  ))}
                </div>
              )}
              <details className="alternate-names">
                <summary>Alternative titles</summary>
                <ul>
                  {Array.from(new Set(t.alternativeTitles)).map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                </ul>
              </details>
            </section>
            <section id="connections" className="detail-section">
              <p className="eyebrow coral">THE CONNECTED-STORY ATLAS</p>
              <h2>Follow the thread.</h2>
              <p className="small-note">
                Adaptations, sequels, and other connections. Relationships are
                not a recommended watch order.
              </p>
              {t.relations.length ? (
                <div className="relation-map">
                  {t.relations.map((r) => (
                    <Link
                      key={`${r.medium}/${r.id}/${r.relation}`}
                      href={`/${r.medium}/${r.id}`}
                      prefetch={false}
                    >
                      <span>
                        {r.relation} / {r.medium}
                      </span>
                      <strong>{r.title}</strong>
                      <b>↗</b>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="small-note">
                  No related titles were supplied by the data provider.
                </p>
              )}
            </section>
            {t.external.length > 0 && (
              <section className="detail-section">
                <h2>Beyond the archive</h2>
                <p className="small-note">
                  Official and streaming links supplied by the metadata
                  provider. Availability varies by country; these are not
                  playback guarantees.
                </p>
                <div className="external-links">
                  {Array.from(
                    new Map(t.external.map((e) => [e.url, e])).values(),
                  ).map((e) => (
                    <a
                      key={e.url}
                      href={e.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {e.name} ↗
                    </a>
                  ))}
                </div>
              </section>
            )}
          </div>
          <aside>
            <Tracker title={t} />
          </aside>
        </div>
        <Suspense
          fallback={
            <div className="loading-shelf" aria-label="Loading characters" />
          }
        >
          <Characters medium={medium} id={numericId} />
        </Suspense>
        <Suspense
          fallback={
            <div
              className="loading-shelf"
              aria-label="Loading similar stories"
            />
          }
        >
          <Recommendations medium={medium} id={numericId} />
        </Suspense>
        <SourceNote source={result.source} />
      </div>
    </div>
  );
}
