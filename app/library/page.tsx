import { LibraryView } from "@/components/library/views";
export const metadata = {
  title: "Your library",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <LibraryView />;
}
