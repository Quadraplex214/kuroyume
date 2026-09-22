import { EntityPage } from "@/components/title/entity-page";
export const metadata = { title: "Studio atlas" };
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <EntityPage id={(await params).id} kind="studio" />;
}
