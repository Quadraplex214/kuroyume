"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Bookmark, Check, Heart, GitCompareArrows } from "lucide-react";
import type { Title } from "@/lib/catalog/types";
import {
  useLibrary,
  saveTitle,
  removeTitle,
  visitTitle,
  toggleCompare,
} from "@/lib/library/store";
import { keyOf, statuses, type Status } from "@/lib/library/model";

export function SaveButton({ title }: { title: Title }) {
  const { state } = useLibrary();
  const saved = !!state.entries[keyOf(title)];
  return (
    <button
      className={`save-button ${saved ? "is-saved" : ""}`}
      aria-label={`${saved ? "Remove" : "Save"} ${title.title}`}
      aria-pressed={saved}
      onClick={() => (saved ? removeTitle(title) : saveTitle(title))}
    >
      {saved ? <Check size={16} /> : <Bookmark size={16} />}
    </button>
  );
}
export function Tracker({ title }: { title: Title }) {
  const { state, persistent, message } = useLibrary();
  const entry = state.entries[keyOf(title)];
  const compared = state.compare.some((t) => keyOf(t) === keyOf(title));
  const [notice, setNotice] = useState("");
  useEffect(() => {
    visitTitle(title);
  }, [title]);
  const total = title.medium === "anime" ? title.episodes : title.chapters;
  return (
    <section className="tracker">
      <p className="eyebrow coral">YOUR STORY, YOUR PACE</p>
      <div className="tracker-actions">
        <button
          className="primary-action"
          onClick={() => {
            if (entry) {
              removeTitle(title);
            } else {
              saveTitle(title);
            }
            setNotice(entry ? "Removed from library" : "Saved to your library");
          }}
        >
          {entry ? <Check size={16} /> : <Bookmark size={16} />}{" "}
          {entry ? "In your library" : "Add to library"}
        </button>
        <button
          className={`round-button ${entry?.favorite ? "active" : ""}`}
          aria-label="Favorite this story"
          aria-pressed={entry?.favorite ?? false}
          onClick={() => saveTitle(title, { favorite: !entry?.favorite })}
        >
          <Heart size={17} />
        </button>
        <button
          className={`round-button ${compared ? "active" : ""}`}
          aria-label="Compare this story"
          aria-pressed={compared}
          onClick={() => {
            toggleCompare(title);
            setNotice(
              compared
                ? "Removed from comparison"
                : "Added to comparison. The two most recent selections are kept.",
            );
          }}
        >
          <GitCompareArrows size={17} />
        </button>
      </div>
      {entry && (
        <div className="tracker-fields">
          <label>
            Status
            <select
              value={entry.status}
              onChange={(e) =>
                saveTitle(title, { status: e.target.value as Status })
              }
            >
              {statuses
                .filter((s) =>
                  title.medium === "anime" ? s !== "reading" : s !== "watching",
                )
                .map((s) => (
                  <option key={s} value={s}>
                    {s.replace("-", " ")}
                  </option>
                ))}
            </select>
          </label>
          <label>
            {title.medium === "anime" ? "Episodes watched" : "Chapters read"}
            {total ? ` / ${total}` : ""}
            <input
              type="number"
              min={0}
              max={total ?? 100000}
              value={entry.progress}
              onChange={(e) =>
                saveTitle(title, {
                  progress: Math.min(
                    total ?? 100000,
                    Math.max(0, Math.floor(Number(e.target.value) || 0)),
                  ),
                })
              }
            />
          </label>
          <label>
            Your rating
            <select
              value={entry.rating}
              onChange={(e) =>
                saveTitle(title, { rating: Number(e.target.value) })
              }
            >
              <option value={0}>Not rated</option>
              {Array.from({ length: 10 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1} / 10
                </option>
              ))}
            </select>
          </label>
          <label>
            Collection
            <input
              maxLength={60}
              placeholder="Rainy-day reads"
              value={entry.collection}
              onChange={(e) => saveTitle(title, { collection: e.target.value })}
            />
          </label>
          <label className="wide">
            Private notes
            <textarea
              maxLength={4000}
              rows={3}
              placeholder="What stayed with you?"
              value={entry.notes}
              onChange={(e) => saveTitle(title, { notes: e.target.value })}
            />
          </label>
        </div>
      )}
      <div className="tracker-links">
        <Link href="/library">Open library ↗</Link>
        <Link href="/compare">Compare ({state.compare.length}/2) ↗</Link>
      </div>
      <p className="small-note" role="status">
        {!persistent
          ? message
          : notice ||
            "Private and saved on this device."}
      </p>
    </section>
  );
}
