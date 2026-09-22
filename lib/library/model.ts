import type { Title } from "../catalog/types";
export const LIBRARY_SCHEMA_VERSION = 1;
export const MAX_LIBRARY_ENTRIES = 2000;
export const MAX_LIBRARY_FILE_BYTES = 2_000_000;
export const statuses = [
  "planned",
  "watching",
  "reading",
  "completed",
  "on-hold",
  "dropped",
] as const;
export type Status = (typeof statuses)[number];
export type LibraryEntry = {
  title: Title;
  status: Status;
  progress: number;
  rating: number;
  favorite: boolean;
  notes: string;
  collection: string;
  updatedAt: string;
};
export type LibraryState = {
  version: typeof LIBRARY_SCHEMA_VERSION;
  entries: Record<string, LibraryEntry>;
  recent: Title[];
  compare: Title[];
};
export function emptyLibrary(): LibraryState {
  return {
    version: LIBRARY_SCHEMA_VERSION,
    entries: {},
    recent: [],
    compare: [],
  };
}
export const keyOf = (t: Pick<Title, "id" | "medium">) => `${t.medium}/${t.id}`;
export function validTitle(value: unknown): value is Title {
  if (!value || typeof value !== "object") return false;
  const t = value as Title;
  return (
    Number.isSafeInteger(t.id) &&
    t.id > 0 &&
    ["anime", "manga"].includes(t.medium) &&
    typeof t.title === "string" &&
    t.title.length > 0 &&
    t.title.length <= 500
  );
}
export function titleSnapshot(value: Title): Title {
  return {
    id: value.id,
    medium: value.medium,
    title: value.title,
    image:
      typeof value.image === "string" &&
      (value.image.startsWith("/artwork/") ||
        /^https:\/\/cdn\.myanimelist\.net\/images\//.test(value.image))
        ? value.image
        : null,
    score: typeof value.score === "number" ? value.score : null,
    rank: typeof value.rank === "number" ? value.rank : null,
    popularity: typeof value.popularity === "number" ? value.popularity : null,
    members: typeof value.members === "number" ? value.members : null,
    format: typeof value.format === "string" ? value.format : null,
    status: typeof value.status === "string" ? value.status : null,
    episodes: typeof value.episodes === "number" ? value.episodes : null,
    chapters: typeof value.chapters === "number" ? value.chapters : null,
    year: typeof value.year === "number" ? value.year : null,
    genres: Array.isArray(value.genres)
      ? value.genres
          .filter(
            (g) => g && Number.isInteger(g.id) && typeof g.name === "string",
          )
          .slice(0, 20)
      : [],
    synopsis:
      typeof value.synopsis === "string" ? value.synopsis.slice(0, 5000) : "",
  };
}
export function parseLibrary(value: unknown): LibraryState {
  if (
    !value ||
    typeof value !== "object" ||
    (value as LibraryState).version !== LIBRARY_SCHEMA_VERSION
  )
    throw new Error("This is not a supported Kuroyume library file.");
  const raw = value as LibraryState;
  const result = emptyLibrary();
  const entries = Object.values(raw.entries ?? {});
  if (entries.length > MAX_LIBRARY_ENTRIES)
    throw new Error("Import is limited to 2,000 stories.");
  for (const e of entries) {
    if (!e || !validTitle(e.title) || !statuses.includes(e.status))
      throw new Error("The library contains an invalid story or status.");
    result.entries[keyOf(e.title)] = {
      title: titleSnapshot(e.title),
      status: e.status,
      progress: Math.max(
        0,
        Math.min(100000, Math.floor(Number(e.progress) || 0)),
      ),
      rating: Math.max(0, Math.min(10, Math.round(Number(e.rating) || 0))),
      favorite: e.favorite === true,
      notes: typeof e.notes === "string" ? e.notes.slice(0, 4000) : "",
      collection:
        typeof e.collection === "string" ? e.collection.slice(0, 60) : "",
      updatedAt:
        typeof e.updatedAt === "string"
          ? e.updatedAt
          : new Date(0).toISOString(),
    };
  }
  result.recent = Array.isArray(raw.recent)
    ? raw.recent.filter(validTitle).slice(0, 20).map(titleSnapshot)
    : [];
  result.compare = Array.isArray(raw.compare)
    ? Array.from(
        new Map(
          raw.compare
            .filter(validTitle)
            .map((t) => [keyOf(t), titleSnapshot(t)]),
        ).values(),
      ).slice(0, 2)
    : [];
  return result;
}
export function migrateBookmarks(ids: unknown): LibraryState {
  const state = emptyLibrary();
  if (!Array.isArray(ids)) return state;
  for (const value of ids) {
    if (typeof value !== "string" || !/^(anime|manga)\/[1-9]\d*$/.test(value))
      continue;
    const [medium, id] = value.split("/");
    const title: Title = {
      id: Number(id),
      medium: medium as Title["medium"],
      title: `Saved ${medium} #${id}`,
      image: null,
      score: null,
      rank: null,
      popularity: null,
      members: null,
      format: null,
      status: null,
      episodes: null,
      chapters: null,
      year: null,
      genres: [],
      synopsis: "",
    };
    state.entries[value] = {
      title,
      status: "planned",
      progress: 0,
      rating: 0,
      favorite: false,
      notes: "",
      collection: "",
      updatedAt: new Date(0).toISOString(),
    };
  }
  return state;
}
