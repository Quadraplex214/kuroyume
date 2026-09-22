"use client";
import Link from "next/link";
import { useState, type ChangeEvent } from "react";
import {
  Download,
  Upload,
  Heart,
  BookOpen,
  CheckCircle2,
  Bookmark,
  Trash2,
} from "lucide-react";
import {
  useLibrary,
  mutateLibrary,
  removeTitle,
} from "@/lib/library/store";
import {
  MAX_LIBRARY_FILE_BYTES,
  parseLibrary,
  statuses,
  keyOf,
  type LibraryState,
} from "@/lib/library/model";
import { TitleGrid, SectionTitle } from "@/components/catalog/cards";
import { Artwork } from "@/components/catalog/artwork";
export function RecentShelf() {
  const { state } = useLibrary();
  if (!state.recent.length) return null;
  return (
    <section className="hub-section page-width">
      <SectionTitle
        eyebrow="PICK UP THE THREAD"
        title="Still on your mind."
        href="/library"
        action="Your library"
      />
      <TitleGrid items={state.recent.slice(0, 6)} compact />
    </section>
  );
}
export function LibraryView() {
  const { state, message } = useLibrary();
  const [tab, setTab] = useState("all");
  const [query, setQuery] = useState("");
  const [collection, setCollection] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState<LibraryState | null>(null);
  const entries = Object.values(state.entries);
  const collections = Array.from(
    new Set(entries.map((e) => e.collection).filter(Boolean)),
  ).sort();
  const filtered = entries
    .filter(
      (e) =>
        (tab === "all" ||
          (tab === "favorites" ? e.favorite : e.status === tab)) &&
        (!collection || e.collection === collection) &&
        `${e.title.title} ${e.notes}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  async function download() {
    const payload = JSON.stringify(state, null, 2);
    if (new Blob([payload]).size > MAX_LIBRARY_FILE_BYTES) {
      setNotice('This library exceeds the 2 MB backup limit. Shorten large notes before exporting.');
      return;
    }
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "kuroyume-library.json";
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice("Library exported. Keep the file somewhere safe.");
  }
  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > MAX_LIBRARY_FILE_BYTES)
        throw new Error("Choose a JSON file smaller than 2 MB.");
      const value = parseLibrary(JSON.parse(await file.text()));
      setPending(value);
      setNotice(
        "Review the import below. Existing entries will keep your current progress and notes.",
      );
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Unable to read this file.",
      );
    }
    event.target.value = "";
  }
  async function confirmImport() {
    if (!pending) return;
    mutateLibrary((current) => ({
      ...current,
      entries: { ...pending.entries, ...current.entries },
    }));
    setPending(null);
    setNotice("Import complete. Your existing entries were preserved.");
  }
  return (
    <div className="page-width platform-page">
      <div className="page-intro">
        <p className="eyebrow coral">A LITTLE SPACE OF YOUR OWN</p>
        <h1>
          Your stories.
          <br />
          <em>Your pace.</em>
        </h1>
        <p>
          A watchlist, a reading journal, a record of worlds you’ve visited.
          <br />
          Private, and stored on this device. Export a copy to keep it safe.
        </p>
      </div>
      <div className="library-stats">
        {[
          { label: "Stories saved", value: entries.length, Icon: Bookmark },
          {
            label: "In progress",
            value: entries.filter((e) =>
              ["watching", "reading"].includes(e.status),
            ).length,
            Icon: BookOpen,
          },
          {
            label: "Completed",
            value: entries.filter((e) => e.status === "completed").length,
            Icon: CheckCircle2,
          },
          {
            label: "Favorites",
            value: entries.filter((e) => e.favorite).length,
            Icon: Heart,
          },
        ].map(({ label, value, Icon }) => (
          <div key={label}>
            <Icon size={17} />
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <div className="library-toolbar">
        <label className="catalog-search">
          <input
            aria-label="Search your library"
            placeholder="Search titles or notes…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label="Filter by collection"
          value={collection}
          onChange={(e) => setCollection(e.target.value)}
        >
          <option value="">All collections</option>
          {collections.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <button className="text-action" onClick={() => void download()}>
          <Download size={15} />
          Export
        </button>
        <label className="text-action import-label">
          <Upload size={15} />
          Import
          <input
            type="file"
            accept="application/json,.json"
            onChange={importFile}
          />
        </label>
      </div>
      <div className="route-tabs">
        {["all", ...statuses, "favorites", "recent"].map((value) => (
          <button
            key={value}
            className={tab === value ? "active" : ""}
            aria-pressed={tab === value}
            onClick={() => setTab(value)}
          >
            {value.replace("-", " ")}
          </button>
        ))}
      </div>
      <p className="small-note" role="status">
        {notice || message}
      </p>
      {pending && (
        <div className="import-review">
          <h3>Import {Object.keys(pending.entries).length} stories?</h3>
          <p>
            New stories are merged. Existing entries, notes and progress are
            preserved.
          </p>
          <button
            className="primary-action"
            onClick={() => void confirmImport()}
          >
            Merge library
          </button>
          <button className="text-action" onClick={() => setPending(null)}>
            Cancel
          </button>
        </div>
      )}
      {tab === "recent" ? (
        <>
          <SectionTitle
            eyebrow="YOUR EXPLORATION TRAIL"
            title="Recently viewed"
          />
          <TitleGrid items={state.recent} />
          {state.recent.length > 0 && (
            <button
              className="text-action"
              onClick={() => {
                mutateLibrary((s) => ({ ...s, recent: [] }));
                setNotice("Recently viewed history cleared.");
              }}
            >
              Clear viewing history
            </button>
          )}
        </>
      ) : filtered.length ? (
        <div className="library-list">
          {filtered.map((entry) => (
            <article key={keyOf(entry.title)}>
              <Link href={`/${keyOf(entry.title)}`} className="library-cover">
                <Artwork
                  src={entry.title.image}
                  alt={entry.title.title}
                  sizes="80px"
                />
              </Link>
              <div>
                <p className="eyebrow coral">
                  {entry.status.replace("-", " ")}{" "}
                  {entry.favorite ? " / FAVORITE" : ""}
                </p>
                <h2>
                  <Link href={`/${keyOf(entry.title)}`}>
                    {entry.title.title}
                  </Link>
                </h2>
                <p>
                  {entry.progress}{" "}
                  {entry.title.medium === "anime"
                    ? "episodes watched"
                    : "chapters read"}{" "}
                  {entry.rating > 0 ? ` · Your score ${entry.rating}/10` : ""}
                </p>
                {entry.collection && (
                  <span className="collection-label">{entry.collection}</span>
                )}
                {entry.notes && <p className="library-note">{entry.notes}</p>}
              </div>
              <Link href={`/${keyOf(entry.title)}`} className="text-action">
                Update ↗
              </Link>
              <button
                className="icon-button"
                aria-label={`Remove ${entry.title.title} from library`}
                onClick={() => removeTitle(entry.title)}
              >
                <Trash2 size={15} />
              </button>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <BookOpen size={30} />
          <h3>Your next story belongs here.</h3>
          <p>
            Save a title to start. Update its progress and notes from the title
            page.
          </p>
          <Link className="primary-action" href="/discover">
            Find your first story ↗
          </Link>
        </div>
      )}
    </div>
  );
}
export function CompareView() {
  const { state } = useLibrary();
  return (
    <div className="page-width platform-page">
      <div className="page-intro">
        <p className="eyebrow coral">TWO WORLDS. ONE NEXT CHAPTER.</p>
        <h1>The side-by-side.</h1>
        <p>
          Compare two stories before choosing what comes next. Add titles using
          the compare control on a detail page.
        </p>
      </div>
      {state.compare.length ? (
        <>
          <div className="comparison">
            {state.compare.map((t) => (
              <article key={keyOf(t)}>
                <div className="compare-cover">
                  <Artwork src={t.image} alt={t.title} sizes="200px" />
                </div>
                <h2>
                  <Link href={`/${keyOf(t)}`}>{t.title} ↗</Link>
                </h2>
                <dl>
                  {[
                    ["Format", t.format ?? t.medium],
                    ["Community score", t.score?.toFixed(2) ?? "Not available"],
                    ["Status", t.status ?? "Unknown"],
                    [
                      "Length",
                      t.medium === "anime"
                        ? `${t.episodes ?? "Unknown"} episodes`
                        : `${t.chapters ?? "Unknown"} chapters`,
                    ],
                    [
                      "Genres",
                      t.genres.map((g) => g.name).join(", ") || "Not available",
                    ],
                    [
                      "Your library",
                      state.entries[keyOf(t)]?.status ?? "Not saved",
                    ],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
                <Link href={`/${keyOf(t)}`} className="primary-action">
                  Explore this story ↗
                </Link>
              </article>
            ))}
            {state.compare.length === 1 && (
              <div className="empty-state">
                <h3>A second perspective.</h3>
                <Link href="/discover" className="text-action">
                  Find another story ↗
                </Link>
              </div>
            )}
          </div>
          <button
            className="text-action"
            onClick={() => mutateLibrary((s) => ({ ...s, compare: [] }))}
          >
            Clear comparison
          </button>
        </>
      ) : (
        <div className="empty-state">
          <h3>What are you choosing between?</h3>
          <p>
            Open a title and tap its compare button. Your two latest selections
            appear here.
          </p>
          <Link className="primary-action" href="/discover">
            Explore stories ↗
          </Link>
        </div>
      )}
    </div>
  );
}
