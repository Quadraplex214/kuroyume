import { EntityPage } from "@/components/title/entity-page";
export const metadata = { title: "Character atlas" };
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <EntityPage id={(await params).id} kind="character" />;
}
