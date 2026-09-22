import Link from "next/link";
import {
  getRankings,
  currentSeason,
  rankCategories,
} from "@/lib/catalog/service";
import { CatalogResult, Pagination } from "./cards";
import type { Medium } from "@/lib/catalog/types";
export type SearchParams = Promise<
  Record<string, string | string[] | undefined>
>;
export function scalar(v: string | string[] | undefined) {
  return typeof v === "string" ? v : "";
}
export function pageNumber(v: string) {
  return /^\d+$/.test(v) ? Math.min(100, Math.max(1, Number(v))) : 1;
}
const labels: Record<string, string> = {
  all: "Top rated",
  airing: "Currently airing",
  upcoming: "Coming soon",
  bypopularity: "Most popular",
  favorite: "Most loved",
  tv: "TV series",
  movie: "Films",
  manga: "Manga",
  manhwa: "Manhwa",
  manhua: "Manhua",
  lightnovels: "Light novels",
};
export async function BrowsePage({
  medium,
  manhwa = false,
  searchParams,
}: {
  medium: Medium;
  manhwa?: boolean;
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const page = pageNumber(scalar(params.page));
  const raw = scalar(params.category);
  const category = manhwa
    ? "manhwa"
    : rankCategories[medium].includes(raw)
      ? raw
      : "all";
  const result = await getRankings(medium, category, page);
  const kind = manhwa ? "Manhwa" : medium === "anime" ? "Anime" : "Manga";
  const path = manhwa ? "/manhwa" : `/${medium}`;
  const season = currentSeason();
  return (
    <div className={`page-width platform-page ${manhwa ? "manhwa-page" : ""}`}>
      <div className="page-intro">
        <p className="eyebrow coral">THE {kind.toUpperCase()} ARCHIVE</p>
        <h1>
          {manhwa
            ? "Beyond the panel."
            : medium === "anime"
              ? "Worlds in motion."
              : "A world in every line."}
        </h1>
        <p>
          {manhwa
            ? "Extraordinary stories from Korea. A dedicated shelf for your next all-consuming read."
            : medium === "anime"
              ? "A familiar feeling. An unexpected favorite. Find the worlds that move you."
              : "Follow the ink. Discover beautifully drawn worlds and stories worth staying up for."}
        </p>
        <div className="intro-links">
          <Link
            href={`/discover?medium=${medium}${manhwa ? "&format=manhwa" : ""}`}
          >
            Search & filters ↗
          </Link>
          {medium === "anime" && (
            <Link href={`/season/${season.year}/${season.season}`}>
              Explore this season ↗
            </Link>
          )}
          <Link href="/recommendations">Follow a recommendation ↗</Link>
        </div>
      </div>
      <div className="route-tabs" aria-label={`${kind} categories`}>
        {(manhwa ? ["manhwa"] : rankCategories[medium]).map((c) => (
          <Link
            key={c}
            href={`${path}?category=${c}`}
            className={category === c ? "active" : ""}
            aria-current={category === c ? "page" : undefined}
          >
            {labels[c]}
          </Link>
        ))}
      </div>
      <div className="results-heading">
        <h2>{labels[category]}</h2>
        <span>COMMUNITY RANKINGS / {String(page).padStart(2, "0")}</span>
      </div>
      <CatalogResult result={result} />
      {result.data && (
        <Pagination
          page={page}
          hasNext={result.data.hasNext}
          pathname={path}
          params={{ category }}
        />
      )}
    </div>
  );
}
