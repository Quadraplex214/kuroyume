"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { editorial } from "@/lib/editorial";
export function Hero() {
  const [feature, setFeature] = useState(0);
  const story = editorial[feature];
  return (
    <>
      <section className="cinema page-width" aria-label="Featured stories">
        <div className="hero-art" key={story.image}>
          <Image
            src={`/artwork/${story.image}-banner.jpg`}
            fill
            loading="eager"
            sizes="100vw"
            alt=""
            className="hero-backdrop"
          />
          <div className="hero-art-wash" />
          <div className="cover-stage">
            <Image
              src={story.cover}
              fill
              loading="eager"
              sizes="(max-width:700px) 65vw,420px"
              alt={`${story.short} key artwork`}
            />
          </div>
        </div>
        <div className="hero-grain" aria-hidden="true" />
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="live-dot" /> YOUR PERSONAL STORY ATLAS
          </p>
          <h1>
            Some stories
            <br />
            stay <em>with you.</em>
          </h1>
          <p className="hero-intro">
            Find a new world. Follow a familiar feeling.
            <br />
            Make room for your next favorite story.
          </p>
          <div className="hero-actions">
            <Link href="/discover" className="primary-action">
              Find your next story <ArrowUpRight size={18} />
            </Link>
            <Link className="text-action" href="/library">
              Make it your own <ArrowRight size={16} />
            </Link>
          </div>
          <div className="hero-footnote">
            <span className="mini-seal">選</span>
            <span>
              Curated with feeling.
              <br />
              <strong>Explored at your own pace.</strong>
            </span>
          </div>
        </div>
        <div className="feature-caption" key={story.id}>
          <p className="eyebrow">
            IN THE SPOTLIGHT /{" "}
            {story.medium === "anime"
              ? "Anime"
              : story.id === 121496
                ? "Manhwa"
                : "Manga"}
          </p>
          <Link href={story.href}>
            <h2>
              {story.short}
              <ArrowUpRight size={22} />
            </h2>
          </Link>
          <p>{story.note}</p>
        </div>
        <div className="feature-controls">
          <span className="feature-count">
            0{feature + 1}
            <span> / 03</span>
          </span>
          <button
            className="round-button"
            aria-label="Previous featured story"
            onClick={() => setFeature((feature + 2) % 3)}
          >
            <ChevronLeft size={17} />
          </button>
          <button
            className="round-button"
            aria-label="Next featured story"
            onClick={() => setFeature((feature + 1) % 3)}
          >
            <ChevronRight size={17} />
          </button>
        </div>
        <span className="vertical-note" aria-hidden="true">
          物語は、ここから。
        </span>
      </section>
      <div className="culture-strip page-width">
        <span>A LITTLE CURIOSITY GOES A LONG WAY</span>
        <div>
          <Link href="/anime">
            アニメ <b>Anime</b>
          </Link>
          <i />
          <Link href="/manga">
            漫画 <b>Manga</b>
          </Link>
          <i />
          <Link href="/manhwa">
            만화 <b>Manhwa</b>
          </Link>
        </div>
        <Link href="/discover" aria-label="Discover stories">
          <ArrowRight size={17} />
        </Link>
      </div>
    </>
  );
}
