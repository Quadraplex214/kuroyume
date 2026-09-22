import { BrowsePage, type SearchParams } from "@/components/catalog/browse";
export const metadata = { title: "Anime" };
export default function Page({ searchParams }: { searchParams: SearchParams }) {
  return <BrowsePage medium="anime" searchParams={searchParams} />;
}
