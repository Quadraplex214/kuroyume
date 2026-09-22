"use client";
import { useRouter } from "next/navigation";
export function SeasonPicker({
  year,
  season,
}: {
  year: number;
  season: string;
}) {
  const router = useRouter();
  return (
    <form
      className="season-picker"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        router.push(`/season/${data.get("year")}/${data.get("season")}`);
      }}
    >
      <label>
        Year
        <input
          name="year"
          type="number"
          min={1960}
          max={new Date().getFullYear() + 2}
          defaultValue={year}
          required
        />
      </label>
      <label>
        Season
        <select name="season" defaultValue={season}>
          {["winter", "spring", "summer", "fall"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <button type="submit" className="primary-action">
        Explore season ↗
      </button>
    </form>
  );
}
