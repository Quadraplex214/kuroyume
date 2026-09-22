"use client";
import Link from "next/link";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="page-width platform-page empty-state">
      <p className="eyebrow coral">A BRIEF INTERRUPTION</p>
      <h1>We lost the thread.</h1>
      <p>
        This page could not be loaded. Your saved library is still on this
        device.
      </p>
      <button className="primary-action" onClick={reset}>
        Try again ↗
      </button>
      <Link href="/library">Visit your library</Link>
    </div>
  );
}
