import "server-only";
import { cache } from "react";
import { request, CatalogError } from "./client";
import {
  obj,
  list,
  str,
  numeric,
  positiveId,
  safeUrl,
  imageFrom,
  genres,
  normalizeRapid,
  normalizeJikan,
  normalizeRapidDetail,
  normalizeJikanDetail,
  normalizeRapidSeason,
} from "./normalize";
import type {
  Medium,
  Title,
  Detail,
  Result,
  CatalogPage,
  SearchFilters,
  Genre,
  Entity,
  EntityRef,
} from "./types";

const failed = <T>(
  e: unknown,
  source: "RapidAPI" | "Jikan" = "Jikan",
): Result<T> => ({
  data: null,
  source,
  error: e instanceof CatalogError ? e.kind : "unavailable",
});
const normalized = (
  raw: unknown[],
  medium: Medium,
  provider: "RapidAPI" | "Jikan",
) =>
  Array.from(
    new Map(
      raw.flatMap((v) => {
        const title =
          provider === "RapidAPI"
            ? normalizeRapid(v, medium)
            : normalizeJikan(v, medium);
        return title ? [[title.id, title] as const] : [];
      }),
    ).values(),
  );
export const rankCategories = {
  anime: [
    "all",
    "airing",
    "upcoming",
    "tv",
    "movie",
    "bypopularity",
    "favorite",
  ],
  manga: [
    "all",
    "manga",
    "manhwa",
    "manhua",
    "lightnovels",
    "bypopularity",
    "favorite",
  ],
};
export const getRankings = cache(
  async (
    medium: Medium,
    category = "all",
    page = 1,
  ): Promise<Result<CatalogPage>> => {
    const cat = rankCategories[medium].includes(category) ? category : "all";
    const p = Math.min(100, Math.max(1, Math.floor(page) || 1));
    try {
      const raw = await request("RapidAPI", `/${medium}/top/${cat}?p=${p}`);
      if (!Array.isArray(raw)) throw new CatalogError("invalid-data");
      return {
        data: {
          items: normalized(raw, medium, "RapidAPI"),
          hasNext: raw.length >= 50,
          page: p,
        },
        source: "RapidAPI",
      };
    } catch {
      try {
        const q = new URLSearchParams({
          page: String(p),
          limit: "24",
          sfw: "true",
        });
        if (["airing", "upcoming", "bypopularity", "favorite"].includes(cat))
          q.set("filter", cat);
        else if (cat !== "all")
          q.set("type", cat === "lightnovels" ? "lightnovel" : cat);
        const raw = obj(await request("Jikan", `/top/${medium}?${q}`));
        return {
          data: {
            items: normalized(list(raw.data), medium, "Jikan"),
            hasNext: !!obj(raw.pagination).has_next_page,
            page: p,
          },
          source: "Jikan",
        };
      } catch (e) {
        return failed(e);
      }
    }
  },
);
export const getGenres = cache(
  async (medium: Medium): Promise<Result<Genre[]>> => {
    try {
      const raw = await request("RapidAPI", `/v2/${medium}/genres`, 604800);
      if (!Array.isArray(raw)) throw new CatalogError("invalid-data");
      return {
        data: genres(raw).filter((g) => ![9, 12, 49].includes(g.id)),
        source: "RapidAPI",
      };
    } catch {
      try {
        const raw = obj(
          await request("Jikan", `/genres/${medium}?filter=genres`, 604800),
        );
        return { data: genres(raw.data), source: "Jikan" };
      } catch (e) {
        return failed(e);
      }
    }
  },
);
export const getDetail = cache(
  async (medium: Medium, id: number): Promise<Result<Detail>> => {
    if (!positiveId(id)) return failed(new CatalogError("not-found"));
    const [rapid, jikan] = await Promise.allSettled([
      request("RapidAPI", `/${medium}/${id}`, 86400),
      request("Jikan", `/${medium}/${id}/full`, 86400),
    ]);
    const a =
      rapid.status === "fulfilled"
        ? normalizeRapidDetail(rapid.value, medium, id)
        : null;
    const b =
      jikan.status === "fulfilled"
        ? normalizeJikanDetail(obj(jikan.value).data, medium)
        : null;
    if (a && b)
      return {
        data: {
          ...b,
          title: a.title,
          score: a.score ?? b.score,
          rank: a.rank ?? b.rank,
          members: a.members ?? b.members,
          synopsis: a.synopsis || b.synopsis,
        },
        source: "RapidAPI",
      };
    if (a) return { data: a, source: "RapidAPI" };
    if (b) return { data: b, source: "Jikan" };
    return failed(
      rapid.status === "rejected" &&
        rapid.reason instanceof CatalogError &&
        rapid.reason.kind === "not-found" &&
        jikan.status === "rejected" &&
        jikan.reason instanceof CatalogError &&
        jikan.reason.kind === "not-found"
        ? rapid.reason
        : new CatalogError("unavailable"),
    );
  },
);
export async function searchCatalog(
  filters: SearchFilters,
): Promise<Result<CatalogPage>> {
  const { medium } = filters;
  const p = Math.min(100, Math.max(1, filters.page ?? 1));
  if (
    medium === "manga" &&
    filters.format === "manhwa" &&
    !filters.q &&
    !filters.genre &&
    !filters.status &&
    !filters.score &&
    !filters.year &&
    !filters.studio &&
    (!filters.sort || filters.sort === "score")
  )
    return getRankings("manga", "manhwa", p);
  const q = new URLSearchParams({ page: String(p), limit: "24", sfw: "true" });
  if (filters.q?.trim()) q.set("q", filters.q.trim().slice(0, 120));
  if (filters.genre && /^\d+(,\d+)*$/.test(filters.genre))
    q.set("genres", filters.genre);
  const formats =
    medium === "anime"
      ? ["tv", "movie", "ova", "ona", "special"]
      : ["manga", "manhwa", "manhua", "lightnovel", "novel", "oneshot"];
  if (formats.includes(filters.format ?? "")) q.set("type", filters.format!);
  const statuses =
    medium === "anime"
      ? ["airing", "complete", "upcoming"]
      : ["publishing", "complete", "hiatus", "discontinued", "upcoming"];
  if (statuses.includes(filters.status ?? "")) q.set("status", filters.status!);
  if (filters.score && numeric(filters.score) !== null)
    q.set("min_score", String(Math.min(10, Number(filters.score))));
  if (
    filters.year &&
    /^\d{4}$/.test(filters.year) &&
    Number(filters.year) >= 1900 &&
    Number(filters.year) <= new Date().getFullYear() + 3
  ) {
    q.set("start_date", `${filters.year}-01-01`);
    q.set("end_date", `${filters.year}-12-31`);
  }
  if (medium === "anime" && positiveId(filters.studio))
    q.set("producers", filters.studio!);
  const sort = ["score", "members", "start_date", "title"].includes(
    filters.sort ?? "",
  )
    ? filters.sort!
    : "members";
  q.set("order_by", sort);
  q.set("sort", sort === "title" ? "asc" : "desc");
  try {
    const raw = obj(await request("Jikan", `/${medium}?${q}`, 300));
    if (!Array.isArray(raw.data)) throw new CatalogError("invalid-data");
    return {
      data: {
        items: normalized(raw.data, medium, "Jikan"),
        hasNext: !!obj(raw.pagination).has_next_page,
        page: p,
      },
      source: "Jikan",
    };
  } catch (e) {
    // A fallback must never silently drop advanced filters or pagination.
    if (
      filters.q &&
      !filters.format &&
      !filters.status &&
      !filters.year &&
      !filters.studio &&
      !filters.sort &&
      p === 1
    ) {
      try {
        const params = new URLSearchParams({
          q: filters.q,
          n: "24",
          score: filters.score ?? "0",
          genre: filters.genre ?? "",
        });
        const raw = await request(
          "RapidAPI",
          `/v2/${medium}/search?${params}`,
          300,
        );
        if (!Array.isArray(raw)) throw new CatalogError("invalid-data");
        return {
          data: {
            items: normalized(raw, medium, "RapidAPI"),
            hasNext: false,
            page: 1,
          },
          source: "RapidAPI",
        };
      } catch {}
    }
    return failed(e);
  }
}
export const getSeason = cache(
  async (
    year: number,
    season: string,
    page = 1,
  ): Promise<Result<CatalogPage>> => {
    if (
      !["winter", "spring", "summer", "fall"].includes(season) ||
      year < 1960 ||
      year > new Date().getFullYear() + 2
    )
      return failed(new CatalogError("not-found"));
    try {
      const raw = await request(
        "RapidAPI",
        `/v2/anime/seasonal?year=${year}&season=${season}`,
      );
      if (!Object.values(obj(raw)).some(Array.isArray))
        throw new CatalogError("invalid-data");
      const items = normalizeRapidSeason(raw);
      return {
        data: {
          items: items.slice((page - 1) * 24, page * 24),
          hasNext: items.length > page * 24,
          page,
        },
        source: "RapidAPI",
      };
    } catch {
      /* Jikan is a secondary source when the seasonal feed is unavailable. */
    }
    try {
      const raw = obj(
        await request(
          "Jikan",
          `/seasons/${year}/${season}?page=${Math.min(100, Math.max(1, page))}&limit=24&sfw=true`,
        ),
      );
      return {
        data: {
          items: normalized(list(raw.data), "anime", "Jikan"),
          hasNext: !!obj(raw.pagination).has_next_page,
          page,
        },
        source: "Jikan",
      };
    } catch (e) {
      return failed(e);
    }
  },
);
export const getRecommendations = cache(
  async (medium: Medium, id: number): Promise<Result<Title[]>> => {
    try {
      const raw = obj(
        await request("RapidAPI", `/v2/${medium}/recommendations/${id}`, 86400),
      );
      if (!Array.isArray(raw.recommendations))
        throw new CatalogError("invalid-data");
      return {
        data: normalized(
          list(raw.recommendations).map((v) => obj(v).recommendation),
          medium,
          "RapidAPI",
        )
          .filter((t) => t.id !== id)
          .slice(0, 12),
        source: "RapidAPI",
      };
    } catch {
      try {
        const raw = obj(
          await request("Jikan", `/${medium}/${id}/recommendations`, 86400),
        );
        return {
          data: normalized(
            list(raw.data).map((v) => obj(v).entry),
            medium,
            "Jikan",
          )
            .filter((t) => t.id !== id)
            .slice(0, 12),
          source: "Jikan",
        };
      } catch (e) {
        return failed(e);
      }
    }
  },
);
export const getCharacters = cache(
  async (medium: Medium, id: number): Promise<Result<EntityRef[]>> => {
    try {
      const raw = obj(
        await request("Jikan", `/${medium}/${id}/characters`, 86400),
      );
      return {
        data: list(raw.data)
          .slice(0, 12)
          .flatMap((v) => {
            const row = obj(v),
              c = obj(row.character),
              cid = positiveId(c.mal_id);
            return cid
              ? [
                  {
                    id: cid,
                    name: str(c.name),
                    image: imageFrom(c),
                    role: str(row.role),
                  },
                ]
              : [];
          }),
        source: "Jikan",
      };
    } catch (e) {
      return failed(e);
    }
  },
);
export const getEntity = cache(
  async (
    kind: "character" | "person" | "studio",
    id: number,
  ): Promise<Result<Entity>> => {
    try {
      const endpoint =
        kind === "character"
          ? "characters"
          : kind === "person"
            ? "people"
            : "producers";
      const raw = obj(
        obj(await request("Jikan", `/${endpoint}/${id}/full`, 86400)).data,
      );
      if (!positiveId(raw.mal_id)) throw new CatalogError("not-found");
      const works: Title[] = [];
      for (const medium of ["anime", "manga"] as const) {
        for (const v of list(raw[medium]).slice(0, 30)) {
          const r = obj(v);
          const item = normalizeJikan(r[medium] ?? r, medium);
          if (item) works.push(item);
        }
      }
      const people: EntityRef[] = list(raw.voices).flatMap((v) => {
        const r = obj(v),
          person = obj(r.person),
          pid = positiveId(person.mal_id);
        return pid
          ? [
              {
                id: pid,
                name: str(person.name),
                image: imageFrom(person),
                role: str(r.language),
              },
            ]
          : [];
      });
      return {
        data: {
          id,
          name:
            str(raw.name) || str(obj(list(raw.titles)[0]).title) || "Studio",
          image: imageFrom(raw),
          about: str(raw.about),
          works: Array.from(
            new Map(works.map((t) => [`${t.medium}/${t.id}`, t])).values(),
          ),
          people,
          url: safeUrl(raw.url),
        },
        source: "Jikan",
      };
    } catch (e) {
      return failed(e);
    }
  },
);
export function currentSeason() {
  const date = new Date();
  return {
    year: date.getUTCFullYear(),
    season: ["winter", "spring", "summer", "fall"][
      Math.floor(date.getUTCMonth() / 3)
    ],
  };
}
