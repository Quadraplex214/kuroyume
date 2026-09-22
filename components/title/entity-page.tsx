import Link from "next/link";
import { notFound } from "next/navigation";
import { getEntity, searchCatalog } from "@/lib/catalog/service";
import { positiveId } from "@/lib/catalog/normalize";
import { Artwork } from "@/components/catalog/artwork";
import {
  SectionTitle,
  TitleGrid,
  ServiceMessage,
  SourceNote,
} from "@/components/catalog/cards";
export async function EntityPage({
  id,
  kind,
}: {
  id: string;
  kind: "character" | "person" | "studio";
}) {
  const numericId = positiveId(id);
  if (!numericId) notFound();
  const result = await getEntity(kind, numericId);
  if (result.error === "not-found") notFound();
  if (!result.data)
    return (
      <div className="page-width platform-page">
        <h1>
          {kind === "studio"
            ? "Studio"
            : kind === "person"
              ? "People & voices"
              : "Character"}{" "}
          profile
        </h1>
        <ServiceMessage error={result.error} />
        <Link className="text-action" href="/discover">
          Continue exploring →
        </Link>
      </div>
    );
  const entity = result.data;
  const studioWorks =
    kind === "studio"
      ? await searchCatalog({ medium: "anime", studio: id })
      : null;
  return (
    <div className="page-width platform-page">
      <Link className="text-action" href="/discover">
        ← Back to discovery
      </Link>
      <section className="entity-header">
        <div className="entity-portrait">
          <Artwork src={entity.image} alt={entity.name} sizes="200px" />
        </div>
        <div>
          <p className="eyebrow coral">
            {kind === "studio"
              ? "THE HANDS BEHIND THE STORY"
              : kind === "person"
                ? "A VOICE. A VISION. A WORLD."
                : "A FAMILIAR FACE, A NEW CONNECTION"}
          </p>
          <h1>{entity.name}</h1>
          {entity.url && (
            <a
              className="text-action"
              href={entity.url}
              target="_blank"
              rel="noreferrer"
            >
              View on MyAnimeList ↗
            </a>
          )}
        </div>
      </section>
      {entity.about && (
        <details className="biography">
          <summary>
            About {entity.name} <span>May contain story spoilers</span>
          </summary>
          <p>{entity.about}</p>
        </details>
      )}
      {entity.people.length > 0 && (
        <section className="detail-section">
          <SectionTitle
            eyebrow="BEHIND THE CHARACTER"
            title="The voices you know"
          />
          <div className="people-grid">
            {entity.people.map((p) => (
              <Link
                key={`${p.id}/${p.role}`}
                href={`/person/${p.id}`}
                className="person-card"
                prefetch={false}
              >
                <div>
                  <Artwork src={p.image} alt={p.name} sizes="100px" />
                </div>
                <h3>{p.name}</h3>
                <p>{p.role}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
      <section className="detail-section">
        <SectionTitle
          eyebrow="FOLLOW THE CONNECTION"
          title={
            kind === "studio" ? "From this studio" : "Stories in their orbit"
          }
          href={
            kind === "studio"
              ? `/discover?medium=anime&studio=${id}`
              : undefined
          }
          action="Explore filmography"
        />
        {studioWorks?.error ? (
          <ServiceMessage error={studioWorks.error} />
        ) : (
          <TitleGrid items={studioWorks?.data?.items ?? entity.works} />
        )}
      </section>
      <SourceNote source="Jikan" />
    </div>
  );
}
