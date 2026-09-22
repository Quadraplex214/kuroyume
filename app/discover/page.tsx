import Link from "next/link";
import { Search } from "lucide-react";
import { getGenres, getRankings, searchCatalog } from "@/lib/catalog/service";
import { CatalogResult, Pagination } from "@/components/catalog/cards";
import { SurpriseButton } from "@/components/catalog/surprise";
import {
  scalar,
  pageNumber,
  type SearchParams,
} from "@/components/catalog/browse";
import type { SearchFilters } from "@/lib/catalog/types";
import { moods } from "@/lib/editorial";
export const metadata = {
  title: "Discover your next story",
  robots: { index: false, follow: true },
};
export default async function Discover({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const raw = await searchParams;
  const medium = scalar(raw.medium) === "manga" ? "manga" : "anime";
  const page = pageNumber(scalar(raw.page));
  const filters: SearchFilters = { medium, page };
  for (const k of [
    "q",
    "genre",
    "format",
    "status",
    "score",
    "year",
    "sort",
    "studio",
  ] as const) {
    const value = scalar(raw[k]);
    if (value) filters[k] = value;
  }
  if (filters.format === "manhwa" && !filters.sort) filters.sort = "score";
  const hasFilters = Object.keys(filters).length > 2;
  const [genreResult, result] = await Promise.all([
    getGenres(medium),
    hasFilters
      ? searchCatalog(filters)
      : getRankings(medium, "bypopularity", page),
  ]);
  const params = Object.fromEntries(
    Object.entries(filters)
      .filter(([k, v]) => k !== "page" && v !== undefined)
      .map(([k, v]) => [k, String(v)]),
  );
  return (
    <div className="page-width platform-page">
      <div className="page-intro">
        <p className="eyebrow coral">THE ART OF GETTING A LITTLE LOST</p>
        <h1>
          Follow your <em>curiosity.</em>
        </h1>
        <p>
          Find a title, chase a feeling, or take a chance on something
          unexpected.
        </p>
      </div>
      <nav className="route-tabs" aria-label="Discovery media">
        <Link
          className={medium === "anime" ? "active" : ""}
          href="/discover?medium=anime"
        >
          Anime
        </Link>
        <Link
          className={
            medium === "manga" && filters.format !== "manhwa" ? "active" : ""
          }
          href="/discover?medium=manga"
        >
          Manga
        </Link>
        <Link
          className={filters.format === "manhwa" ? "active" : ""}
          href="/discover?medium=manga&format=manhwa"
        >
          Manhwa
        </Link>
        <Link href="/recommendations">If you liked… ↗</Link>
      </nav>
      <form className="filter-panel" action="/discover">
        <input type="hidden" name="medium" value={medium} />
        {filters.studio && (
          <input type="hidden" name="studio" value={filters.studio} />
        )}
        <label className="global-search">
          <Search size={20} />
          <input
            name="q"
            aria-label="Search all titles"
            placeholder="A title you love. A story you haven’t met."
            defaultValue={filters.q}
            maxLength={120}
          />
          <button className="primary-action" type="submit">
            Discover <span>↗</span>
          </button>
        </label>
        <div className="filter-grid">
          <label>
            Genre
            <select name="genre" defaultValue={filters.genre ?? ""}>
              <option value="">Every genre</option>
              {(genreResult.data ?? []).map((g) => (
                <option value={g.id} key={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Format
            <select name="format" defaultValue={filters.format ?? ""}>
              <option value="">Every format</option>
              {(medium === "anime"
                ? ["tv", "movie", "ova", "ona", "special"]
                : [
                    "manga",
                    "manhwa",
                    "manhua",
                    "lightnovel",
                    "novel",
                    "oneshot",
                  ]
              ).map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select name="status" defaultValue={filters.status ?? ""}>
              <option value="">Any status</option>
              {(medium === "anime"
                ? ["airing", "complete", "upcoming"]
                : [
                    "publishing",
                    "complete",
                    "hiatus",
                    "discontinued",
                    "upcoming",
                  ]
              ).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label>
            Year window
            <input
              type="number"
              name="year"
              min={1900}
              max={new Date().getFullYear() + 3}
              placeholder="Any year"
              defaultValue={filters.year}
            />
          </label>
          <label>
            Minimum score
            <select name="score" defaultValue={filters.score ?? ""}>
              <option value="">Any score</option>
              {[6, 7, 8, 9].map((n) => (
                <option key={n} value={n}>
                  {n}+ / 10
                </option>
              ))}
            </select>
          </label>
          <label>
            Order by
            <select name="sort" defaultValue={filters.sort ?? ""}>
              <option value="">Popularity</option>
              <option value="score">Community score</option>
              <option value="start_date">Newest first</option>
              <option value="title">Title A–Z</option>
            </select>
          </label>
        </div>
        {hasFilters && (
          <Link className="reset-filters" href={`/discover?medium=${medium}`}>
            Clear all filters{filters.studio ? " including studio" : ""} ×
          </Link>
        )}
      </form>
      <div className="mood-chips">
        {moods.map((m) => (
          <Link key={m.slug} href={`/genre/${m.slug}`}>
            {m.symbol} {m.mood}
          </Link>
        ))}
      </div>
      <div className="results-heading">
        <h2>
          {filters.q
            ? `Results for “${filters.q}”`
            : hasFilters
              ? "Your next possibilities"
              : "Start with a favorite"}
        </h2>
        {result.data && <SurpriseButton items={result.data.items} />}
      </div>
      <CatalogResult result={result} />
      {result.data && (
        <Pagination
          page={page}
          hasNext={result.data.hasNext}
          pathname="/discover"
          params={params}
        />
      )}
    </div>
  );
}
