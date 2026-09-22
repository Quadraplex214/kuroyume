"use client";
import { useSyncExternalStore } from "react";
import type { Title } from "@/lib/catalog/types";
import {
  emptyLibrary,
  parseLibrary,
  migrateBookmarks,
  keyOf,
  titleSnapshot,
  type LibraryState,
  type LibraryEntry,
} from "./model";
const storageKey = "kuroyume-library-v1",
  event = "kuroyume-library-change";
const empty = JSON.stringify(emptyLibrary());
let memory: string | null = null;
let cachedRaw: string | undefined;
let cachedState = emptyLibrary();
function snapshot() {
  if (memory !== null) return memory;
  try {
    const current = localStorage.getItem(storageKey);
    if (current) return current;
    const legacy =
      localStorage.getItem("kuroyume-saved") ??
      localStorage.getItem("kura-saved");
    return legacy
      ? JSON.stringify(migrateBookmarks(JSON.parse(legacy)))
      : empty;
  } catch {
    return empty;
  }
}
function subscribe(notify: () => void) {
  window.addEventListener("storage", notify);
  window.addEventListener(event, notify);
  return () => {
    window.removeEventListener("storage", notify);
    window.removeEventListener(event, notify);
  };
}
function decode(raw: string) {
  if (raw !== cachedRaw) {
    try {
      cachedState = parseLibrary(JSON.parse(raw));
    } catch {
      cachedState = emptyLibrary();
    }
    cachedRaw = raw;
  }
  return cachedState;
}
export function mutateLibrary(
  mutate: (state: LibraryState) => LibraryState,
) {
  const previous = snapshot();
  const next = mutate(structuredClone(decode(previous)));
  const raw = JSON.stringify(next);
  try {
    // Preserve an unreadable library before any automatic recently-viewed write.
    try {
      parseLibrary(JSON.parse(previous));
    } catch {
      localStorage.setItem(`${storageKey}-recovery`, previous);
    }
    localStorage.setItem(storageKey, raw);
    memory = null;
  } catch {
    memory = raw;
  }
  window.dispatchEvent(new Event(event));
  return memory === null;
}
export function useLibrary() {
  const raw = useSyncExternalStore(subscribe, snapshot, () => empty);
  return {
    state: decode(raw),
    persistent: memory === null,
    message: memory === null ? 'Private and saved on this device.' : 'Storage is unavailable. Export your library before closing this tab.',
  };
}
export function saveTitle(
  title: Title,
  patch: Partial<Omit<LibraryEntry, "title" | "updatedAt">> = {},
) {
  return mutateLibrary((s) => {
    const key = keyOf(title);
    s.entries[key] = {
      status: "planned",
      progress: 0,
      rating: 0,
      favorite: false,
      notes: "",
      collection: "",
      ...(s.entries[key] as LibraryEntry | undefined),
      ...patch,
      title: titleSnapshot(title),
      updatedAt: new Date().toISOString(),
    };
    return s;
  });
}
export function removeTitle(title: Title) {
  return mutateLibrary((s) => {
    delete s.entries[keyOf(title)];
    return s;
  });
}
export function visitTitle(title: Title) {
  return mutateLibrary((s) => {
    s.recent = [
      titleSnapshot(title),
      ...s.recent.filter((t) => keyOf(t) !== keyOf(title)),
    ].slice(0, 20);
    if (s.entries[keyOf(title)])
      s.entries[keyOf(title)].title = titleSnapshot(title);
    return s;
  });
}
export function toggleCompare(title: Title) {
  return mutateLibrary((s) => {
    const selected = s.compare.some((t) => keyOf(t) === keyOf(title));
    s.compare = selected
      ? s.compare.filter((t) => keyOf(t) !== keyOf(title))
      : [...s.compare.slice(-1), titleSnapshot(title)];
    return s;
  });
}
