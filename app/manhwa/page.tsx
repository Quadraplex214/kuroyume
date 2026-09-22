import { BrowsePage, type SearchParams } from "@/components/catalog/browse";
export const metadata = { title: "Manhwa" };
export default function Page({ searchParams }: { searchParams: SearchParams }) {
  return <BrowsePage medium="manga" manhwa searchParams={searchParams} />;
}
