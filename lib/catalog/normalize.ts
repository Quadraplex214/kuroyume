import type {
  Medium,
  Title,
  Detail,
  Genre,
  EntityRef,
  Relation,
} from "./types";
export type RecordValue = Record<string, unknown>;
export const obj = (v: unknown): RecordValue =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as RecordValue) : {};
export const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
export const str = (v: unknown): string =>
  typeof v === "string" ? v.trim() : "";
export function numeric(v: unknown): number | null {
  const s = typeof v === "string" ? v.replaceAll(",", "").trim() : v;
  if (s === "" || s === null || s === undefined || typeof s === "boolean")
    return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
export function positiveId(v: unknown): number | null {
  if (typeof v !== "number" && (typeof v !== "string" || !/^\d+$/.test(v)))
    return null;
  const n = numeric(v);
  return n !== null && Number.isSafeInteger(n) && n > 0 ? n : null;
}
export function safeUrl(v: unknown): string | null {
  try {
    const url = new URL(str(v));
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.hostname.includes("https") ||
      !url.hostname.includes(".")
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}
export function imageUrl(v: unknown): string | null {
  const url = safeUrl(v);
  if (!url) return null;
  const host = new URL(url).hostname;
  return ["cdn.myanimelist.net", "myanimelist.net"].includes(host) &&
    url.startsWith("https:")
    ? url
    : null;
}
export function imageFrom(v: unknown): string | null {
  const images = obj(obj(v).images);
  const jpg = obj(images.jpg);
  return imageUrl(jpg.large_image_url ?? jpg.image_url);
}
export function genres(v: unknown): Genre[] {
  return list(v).flatMap((value) => {
    const r = obj(value);
    const id = positiveId(
      r.mal_id ?? r.id ?? str(r.url).match(/\/genre\/(\d+)/)?.[1],
    );
    const name = str(r.name ?? r.title);
    return id && name ? [{ id, name }] : [];
  });
}
export function normalizeRapid(v: unknown, medium: Medium): Title | null {
  const r = obj(v),
    id = positiveId(r.myanimelist_id),
    title = str(r.title);
  if (!id || !title) return null;
  return {
    id,
    medium,
    title,
    image: imageUrl(r.picture_url),
    score: numeric(r.score),
    rank: numeric(r.rank),
    popularity: null,
    members: numeric(r.members),
    format: str(r.type).replace(/\s*\(.*$/, "") || null,
    status: null,
    episodes: null,
    chapters: null,
    year: null,
    genres: [],
    synopsis: str(r.description),
  };
}
export function normalizeJikan(v: unknown, medium: Medium): Title | null {
  const r = obj(v),
    id = positiveId(r.mal_id),
    title = str(r.title_english) || str(r.title) || str(r.name);
  if (!id || !title) return null;
  return {
    id,
    medium,
    title,
    image: imageFrom(r),
    score: numeric(r.score),
    rank: numeric(r.rank),
    popularity: numeric(r.popularity),
    members: numeric(r.members),
    format: str(r.type) || null,
    status: str(r.status) || null,
    episodes: numeric(r.episodes),
    chapters: numeric(r.chapters),
    year: numeric(r.year),
    genres: genres(r.genres),
    synopsis: str(r.synopsis),
  };
}
export function normalizeRapidDetail(
  v: unknown,
  medium: Medium,
  id: number,
): Detail | null {
  const r = obj(v),
    title = str(r.title_en) || str(r.title_ov);
  if (!title) return null;
  const info = obj(r.information),
    stats = obj(r.statistics);
  const base = normalizeRapid(
    {
      myanimelist_id: id,
      title,
      picture_url: r.picture_url,
      score: stats.score,
      rank: stats.ranked,
      members: stats.members,
    },
    medium,
  )!;
  const facts: Record<string, string> = {};
  for (const [key, val] of Object.entries(info)) {
    if (typeof val === "string" && val && val !== "None") facts[key] = val;
  }
  return {
    ...base,
    synopsis: str(r.synopsis),
    popularity: numeric(stats.popularity),
    format: str(obj(list(info.type)[0]).name) || null,
    status: str(info.status) || null,
    episodes: numeric(info.episodes),
    chapters: numeric(info.chapters),
    genres: genres(info.genres),
    alternativeTitles: Object.values(obj(r.alternative_titles))
      .map(str)
      .filter(Boolean),
    facts,
    studios: list(info.studios).flatMap((v) => {
      const x = obj(v),
        eid = positiveId(str(x.url).match(/\/producer\/(\d+)/)?.[1]);
      return eid ? [{ id: eid, name: str(x.name), image: null }] : [];
    }),
    relations: [],
    trailer: null,
    external: [],
    characters: [],
  };
}
export function normalizeJikanDetail(
  v: unknown,
  medium: Medium,
): Detail | null {
  const r = obj(v),
    base = normalizeJikan(r, medium);
  if (!base) return null;
  const facts: Record<string, string> = {};
  for (const key of [
    "status",
    "type",
    "source",
    "duration",
    "rating",
    "volumes",
    "chapters",
    "episodes",
    "year",
    "season",
  ]) {
    const val = r[key];
    if (typeof val === "string" || typeof val === "number")
      facts[key] = String(val);
  }
  const dates = obj(r.aired ?? r.published);
  if (str(dates.string))
    facts[medium === "anime" ? "aired" : "published"] = str(dates.string);
  const studios: EntityRef[] = list(r.studios).flatMap((v) => {
    const x = obj(v),
      id = positiveId(x.mal_id);
    return id ? [{ id, name: str(x.name), image: null }] : [];
  });
  const relations: Relation[] = list(r.relations).flatMap((v) => {
    const group = obj(v);
    return list(group.entry).flatMap((e) => {
      const x = obj(e),
        id = positiveId(x.mal_id);
      return id && (x.type === "anime" || x.type === "manga")
        ? [
            {
              id,
              medium: x.type,
              title: str(x.name),
              relation: str(group.relation),
            },
          ]
        : [];
    });
  });
  const trailer = obj(r.trailer);
  let video = str(trailer.youtube_id);
  if (!video)
    video =
      str(trailer.embed_url).match(
        /youtube(?:-nocookie)?\.com\/embed\/([\w-]{11})/,
      )?.[1] ?? "";
  return {
    ...base,
    facts,
    studios,
    relations,
    alternativeTitles: list(r.titles)
      .map((t) => str(obj(t).title))
      .filter(Boolean),
    trailer: /^[\w-]{11}$/.test(video)
      ? `https://www.youtube.com/watch?v=${video}`
      : null,
    external: [...list(r.streaming), ...list(r.external)].flatMap((v) => {
      const x = obj(v),
        url = safeUrl(x.url);
      return url ? [{ name: str(x.name), url }] : [];
    }),
    characters: [],
  };
}

export function normalizeRapidSeason(value: unknown): Title[] {
  const items = Object.entries(obj(value)).flatMap(([group, entries]) =>
    list(entries).flatMap((v) => {
      const row = obj(v);
      const id = positiveId(str(row.url).match(/\/anime\/(\d+)/)?.[1]);
      const title = str(row.title);
      const tags = genres(row.genres);
      if (!id || !title || tags.some((g) => [9, 12, 49].includes(g.id)))
        return [];
      const base = normalizeRapid(
        {
          myanimelist_id: id,
          title,
          picture_url: row.image_url,
          score: row.score,
          members: row.members,
          type: group,
        },
        "anime",
      )!;
      const date = str(obj(row.date).date);
      return [
        {
          ...base,
          genres: tags,
          episodes: numeric(row.episodes),
          year: /^\d{4}-/.test(date) ? Number(date.slice(0, 4)) : null,
          synopsis: str(row.synopsis),
        },
      ];
    }),
  );
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}
