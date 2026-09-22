import Link from "next/link";
import { getDetail, getRecommendations } from "@/lib/catalog/service";
import { positiveId } from "@/lib/catalog/normalize";
import { scalar, type SearchParams } from "@/components/catalog/browse";
import { ServiceMessage, TitleGrid } from "@/components/catalog/cards";
import { editorial } from "@/lib/editorial";
export const metadata = { title: "Follow the story trail" };
export default async function Page({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const medium = scalar(params.medium) === "manga" ? "manga" : "anime";
  const id =
    positiveId(scalar(params.id)) ?? (medium === "anime" ? 52991 : 121496);
  const [detail, result] = await Promise.all([
    getDetail(medium, id),
    getRecommendations(medium, id),
  ]);
  return (
    <div className="page-width platform-page">
      <div className="page-intro">
        <p className="eyebrow coral">ONE GOOD STORY LEADS TO ANOTHER</p>
        <h1>
          Follow the <em>thread.</em>
        </h1>
        <p>
          Start with a story you love. Discover what the community connects it
          to.
          <br />
          Open any suggestion and keep the trail going.
        </p>
      </div>
      <nav className="route-tabs" aria-label="Recommendation starting points">
        {editorial.slice(0, 3).map((t) => (
          <Link
            key={t.id}
            className={t.id === id && t.medium === medium ? "active" : ""}
            href={`/recommendations?medium=${t.medium}&id=${t.id}`}
          >
            {t.short}
          </Link>
        ))}
        <Link href="/discover">Choose another story ↗</Link>
      </nav>
      <div className="recommendation-seed">
        <span className="eyebrow">BECAUSE YOU LIKED</span>
        <h2>
          <Link href={`/${medium}/${id}`}>
            {detail.data?.title ?? `This ${medium}`} ↗
          </Link>
        </h2>
        <p>
          Community recommendations, not a personalized prediction. Start from
          any title’s “Similar stories” section.
        </p>
      </div>
      {result.data ? (
        <TitleGrid items={result.data} />
      ) : (
        <ServiceMessage error={result.error} />
      )}
    </div>
  );
}
