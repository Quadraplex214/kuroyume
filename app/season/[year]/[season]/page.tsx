import Link from "next/link";
import { notFound } from "next/navigation";
import { getSeason } from "@/lib/catalog/service";
import { CatalogResult, Pagination } from "@/components/catalog/cards";
import { SeasonPicker } from "@/components/catalog/season-picker";
import {
  pageNumber,
  scalar,
  type SearchParams,
} from "@/components/catalog/browse";
const seasons = ["winter", "spring", "summer", "fall"];
export async function generateMetadata({
  params,
}: {
  params: Promise<{ year: string; season: string }>;
}) {
  const p = await params;
  return { title: `${p.season} ${p.year} anime` };
}
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ year: string; season: string }>;
  searchParams: SearchParams;
}) {
  const p = await params;
  const year = Number(p.year),
    season = p.season;
  const index = seasons.indexOf(season);
  if (
    !/^\d{4}$/.test(p.year) ||
    year < 1960 ||
    year > new Date().getFullYear() + 2 ||
    index < 0
  )
    notFound();
  const page = pageNumber(scalar((await searchParams).page));
  const result = await getSeason(year, season, page);
  const prev = `/season/${index === 0 ? year - 1 : year}/${seasons[(index + 3) % 4]}`,
    next = `/season/${index === 3 ? year + 1 : year}/${seasons[(index + 1) % 4]}`;
  return (
    <div className="page-width platform-page season-page">
      <div className="page-intro">
        <p className="eyebrow coral">THE SEASONAL FIELD GUIDE</p>
        <h1>
          <span className="capitalize">{season}</span> <em>{year}.</em>
        </h1>
        <p>
          New worlds, returning favorites, and a reason to look forward to next
          week.
          <br />
          Browse the season. Build your own watchlist.
        </p>
      </div>
      <SeasonPicker year={year} season={season} />
      <div className="season-navigation">
        <Link href={prev}>← Previous season</Link>
        <Link href="/anime?category=airing">Currently airing ↗</Link>
        <Link href={next}>Next season →</Link>
      </div>
      <CatalogResult result={result} />
      {result.data && (
        <Pagination
          page={page}
          hasNext={result.data.hasNext}
          pathname={`/season/${year}/${season}`}
        />
      )}
      <p className="small-note">
        Season assignments come from MyAnimeList via the source shown above.
        Schedules may change; this is not a live episode-release calendar.
      </p>
    </div>
  );
}
