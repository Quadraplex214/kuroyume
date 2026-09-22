import {
  DetailPage,
  titleMetadata,
  type DetailParams,
} from "@/components/title/detail-page";
export async function generateMetadata({ params }: { params: DetailParams }) {
  return titleMetadata(params, "anime");
}
export default function Page({ params }: { params: DetailParams }) {
  return <DetailPage params={params} medium="anime" />;
}
