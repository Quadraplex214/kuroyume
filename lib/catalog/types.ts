export type Medium = "anime" | "manga";
export type Genre = { id: number; name: string };
export type Title = {
  id: number;
  medium: Medium;
  title: string;
  image: string | null;
  score: number | null;
  rank: number | null;
  popularity: number | null;
  members: number | null;
  format: string | null;
  status: string | null;
  episodes: number | null;
  chapters: number | null;
  year: number | null;
  genres: Genre[];
  synopsis: string;
};
export type EntityRef = {
  id: number;
  name: string;
  image: string | null;
  role?: string;
};
export type Relation = {
  id: number;
  medium: Medium;
  title: string;
  relation: string;
};
export type Detail = Title & {
  alternativeTitles: string[];
  facts: Record<string, string>;
  studios: EntityRef[];
  relations: Relation[];
  trailer: string | null;
  external: { name: string; url: string }[];
  characters: EntityRef[];
};
export type Result<T> =
  | { data: T; source: "RapidAPI" | "Jikan"; error?: undefined }
  | { data: null; source: "RapidAPI" | "Jikan"; error: string };
export type CatalogPage = { items: Title[]; hasNext: boolean; page: number };
export type SearchFilters = {
  medium: Medium;
  q?: string;
  page?: number;
  genre?: string;
  format?: string;
  status?: string;
  score?: string;
  year?: string;
  sort?: string;
  studio?: string;
};
export type Entity = EntityRef & {
  about: string;
  works: Title[];
  people: EntityRef[];
  url: string | null;
};
export function titleKey(title: Pick<Title, "medium" | "id">) {
  return `${title.medium}/${title.id}`;
}
