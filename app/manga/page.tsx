import { BrowsePage, type SearchParams } from "@/components/catalog/browse";
export const metadata = { title: "Manga" };
export default function Page({ searchParams }: { searchParams: SearchParams }) {
  return <BrowsePage medium="manga" searchParams={searchParams} />;
}
