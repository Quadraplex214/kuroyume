"use client";
import { useRouter } from "next/navigation";
import type { Title } from "@/lib/catalog/types";
export function SurpriseButton({ items }: { items: Title[] }) {
  const router = useRouter();
  return (
    <button
      className="text-action"
      disabled={!items.length}
      onClick={() => {
        const title = items[Math.floor(Math.random() * items.length)];
        router.push(`/${title.medium}/${title.id}`);
      }}
      aria-label="Pick a random story from these results"
    >
      Surprise me ↗
    </button>
  );
}
