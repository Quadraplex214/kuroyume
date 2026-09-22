import { test } from "vitest";
import assert from "node:assert/strict";
import {
  normalizeRapid,
  normalizeJikan,
  safeUrl,
  positiveId,
  numeric,
  normalizeRapidDetail,
} from "../lib/catalog/normalize.ts";

test("Rapid search does not invent score or media format", () => {
  const item = normalizeRapid(
    {
      myanimelist_id: 2,
      title: "Berserk",
      picture_url: "https://cdn.myanimelist.net/images/manga/1/a.jpg",
    },
    "manga",
  );
  assert.equal(item?.score, null);
  assert.equal(item?.format, null);
  assert.equal(item?.medium, "manga");
});
test("untrusted records and IDs are rejected", () => {
  assert.equal(
    normalizeRapid({ message: "Internal Server Error" }, "anime"),
    null,
  );
  assert.equal(positiveId("2abc"), null);
  assert.equal(positiveId("-1"), null);
  assert.equal(positiveId("52991"), 52991);
});
test("MAL media identities stay separate and unknown totals stay null", () => {
  const a = normalizeJikan(
    { mal_id: 1, title: "Same", episodes: null },
    "anime",
  );
  const b = normalizeJikan({ mal_id: 1, title: "Same", chapters: 0 }, "manga");
  assert.notEqual(a?.medium, b?.medium);
  assert.equal(a?.episodes, null);
  assert.equal(b?.chapters, 0);
});
test("unsafe URLs and malformed hosts are not rendered", () => {
  assert.equal(safeUrl("javascript:alert(1)"), null);
  assert.equal(
    safeUrl("https://myanimelist.nethttps://myanimelist.net/"),
    null,
  );
  assert.equal(
    safeUrl("https://myanimelist.net/anime/1"),
    "https://myanimelist.net/anime/1",
  );
});
test("numeric strings parse without turning unknown values into zero", () => {
  assert.equal(numeric("1,203"), 1203);
  assert.equal(numeric("Unknown"), null);
  assert.equal(numeric(""), null);
  assert.equal(numeric("28 episodes"), null);
});
test("Rapid detail falls back to original title and preserves statistics", () => {
  const result = normalizeRapidDetail(
    {
      title_en: "",
      title_ov: "Solo Leveling",
      information: {
        type: [{ name: "Manhwa" }],
        chapters: "201",
        genres: [
          {
            name: "Action",
            url: "https://myanimelist.net/manga/genre/1/Action",
          },
        ],
      },
      statistics: { score: 8.5, ranked: 22 },
      synopsis: "A story",
    },
    "manga",
    121496,
  );
  assert.equal(result?.title, "Solo Leveling");
  assert.equal(result?.chapters, 201);
  assert.equal(result?.genres[0].id, 1);
  assert.equal(result?.score, 8.5);
});

import { normalizeRapidSeason } from "../lib/catalog/normalize.ts";
test("season groups preserve continuation entries and normalize real IDs", () => {
  const items = normalizeRapidSeason({
    "TV (New)": [
      {
        title: "New story",
        url: "https://myanimelist.net/anime/42/Test",
        image_url: "https://cdn.myanimelist.net/images/anime/1/a.jpg",
        score: 8,
        episodes: 12,
        date: { date: "2025-01-04" },
        genres: [
          {
            name: "Adventure",
            url: "https://myanimelist.net/anime/genre/2/Adventure",
          },
        ],
      },
    ],
    "TV (Continuing)": [
      {
        title: "Long running",
        url: "https://myanimelist.net/anime/21/Test",
        date: { date: "1999-10-20" },
      },
    ],
  });
  assert.equal(items.length, 2);
  assert.equal(items[0].id, 42);
  assert.equal(items[0].year, 2025);
  assert.equal(items[1].id, 21);
  assert.equal(items[1].year, 1999);
});

