import Link from "next/link";
import { Suspense } from "react";
import { Hero } from "@/components/hero";
import {
  SectionTitle,
  TitleGrid,
  ServiceMessage,
} from "@/components/catalog/cards";
import { getRankings, currentSeason } from "@/lib/catalog/service";
import { editorialTitles, moods } from "@/lib/editorial";
import { RecentShelf } from "@/components/library/views";
export const dynamic = "force-dynamic";
async function Shelf({
  medium,
  category,
  title,
  eyebrow,
  href,
}: {
  medium: "anime" | "manga";
  category: string;
  title: string;
  eyebrow: string;
  href: string;
}) {
  const result = await getRankings(medium, category);
  return (
    <section className="hub-section page-width">
      <SectionTitle title={title} eyebrow={eyebrow} href={href} />
      {result.data ? (
        <TitleGrid items={result.data.items.slice(0, 6)} compact />
      ) : (
        <ServiceMessage error={result.error} />
      )}
    </section>
  );
}
export default function Home() {
  const season = currentSeason();
  return (
    <>
      <Hero />
      <RecentShelf />
      <Suspense
        fallback={
          <div
            className="page-width loading-shelf"
            aria-label="Loading popular stories"
          />
        }
      >
        <Shelf
          medium="anime"
          category="bypopularity"
          title="Good stories. Great company."
          eyebrow="THE COMMUNITY’S FAVORITES"
          href="/anime?category=bypopularity"
        />
      </Suspense>
      <section className="editorial">
        <div className="page-width">
          <SectionTitle
            eyebrow="THE EDITOR’S SHELF / 001"
            title="One more chapter."
            href="/manga"
            action="Between the panels"
          />
          <TitleGrid items={editorialTitles.slice(3)} compact />
        </div>
      </section>
      <Suspense fallback={<div className="page-width loading-shelf" />}>
        <Shelf
          medium="manga"
          category="manhwa"
          title="A world beyond the panel."
          eyebrow="THE MANHWA EDIT"
          href="/manhwa"
        />
      </Suspense>
      <section className="season-callout page-width">
        <div>
          <p className="eyebrow coral">YOUR SEASONAL FIELD NOTES</p>
          <h2>
            Meet your next <em>weekly ritual.</em>
          </h2>
          <p>Explore the season. Keep the stories that speak to you.</p>
        </div>
        <Link
          className="primary-action"
          href={`/season/${season.year}/${season.season}`}
        >
          Explore {season.season} {season.year} ↗
        </Link>
      </section>
      <section className="mood-section page-width">
        <div>
          <p className="eyebrow coral">FOLLOW A FEELING</p>
          <h2>
            What’s your <em>mood?</em>
          </h2>
        </div>
        <div className="mood-options">
          {moods.slice(0, 4).map((m) => (
            <Link key={m.slug} href={`/genre/${m.slug}`}>
              <span className="mood-symbol">{m.symbol}</span>
              <span>
                {m.mood}
                <small>{m.name}</small>
              </span>
              <span>↗</span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
