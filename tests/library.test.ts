import { test } from "vitest";
import assert from "node:assert/strict";
import { migrateBookmarks, parseLibrary } from "../lib/library/model.ts";
test("legacy collection keeps medium identity and ignores corrupt keys", () => {
  const state = migrateBookmarks(["anime/1", "manga/1", "anime/-2", "oops"]);
  assert.equal(Object.keys(state.entries).length, 2);
  assert.equal(state.entries["anime/1"].status, "planned");
  assert.equal(parseLibrary(state).entries["manga/1"].title.id, 1);
});
test("unsupported imports are rejected without changing existing state", () => {
  assert.throws(() => parseLibrary({ version: 2 }));
  assert.throws(() =>
    parseLibrary({
      version: 1,
      entries: {
        a: { title: { id: 1, medium: "anime", title: "A" }, status: "bad" },
      },
    }),
  );
});
test("import normalizes progress, unsafe cover URLs and notes", () => {
  const state = migrateBookmarks(["anime/1"]);
  const e = state.entries["anime/1"];
  e.progress = -10;
  e.rating = 900;
  e.title.image = "javascript:alert(1)";
  e.notes = "x".repeat(5000);
  const next = parseLibrary(state);
  assert.equal(next.entries["anime/1"].progress, 0);
  assert.equal(next.entries["anime/1"].rating, 10);
  assert.equal(next.entries["anime/1"].title.image, null);
  assert.equal(next.entries["anime/1"].notes.length, 4000);
});

