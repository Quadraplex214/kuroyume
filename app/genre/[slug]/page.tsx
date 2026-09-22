import Link from "next/link";
import { notFound } from "next/navigation";
import { moods } from "@/lib/editorial";
import { searchCatalog } from "@/lib/catalog/service";
import { CatalogResult } from "@/components/catalog/cards";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const mood = moods.find((m) => m.slug === slug);
  return { title: mood ? `${mood.name} — ${mood.mood}` : "Genre not found" };
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const mood = moods.find((m) => m.slug === slug);
  if (!mood) notFound();
  const result = await searchCatalog({
    medium: "anime",
    genre: String(mood.id),
  });
  return (
    <div className="page-width platform-page genre-page">
      <div className="page-intro">
        <p className="eyebrow coral">
          A FEELING, NOT AN ALGORITHM / {mood.name}
        </p>
        <h1>
          {mood.mood}
          <em>.</em>
        </h1>
        <p>{mood.description}</p>
        <span className="genre-watermark" aria-hidden="true">
          {mood.symbol}
        </span>
        <div className="intro-links">
          <Link href={`/discover?medium=anime&genre=${mood.id}`}>
            Explore anime ↗
          </Link>
          <Link href={`/discover?medium=manga&genre=${mood.id}`}>
            Explore manga ↗
          </Link>
          <Link href={`/discover?medium=manga&format=manhwa&genre=${mood.id}`}>
            Explore manhwa ↗
          </Link>
        </div>
      </div>
      <CatalogResult result={result} />
    </div>
  );
}
