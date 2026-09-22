"use client";
import Image from "next/image";
import { useState } from "react";
export function Artwork({
  src,
  alt,
  sizes = "(max-width: 600px) 45vw, 240px",
  eager = false,
}: {
  src: string | null;
  alt: string;
  sizes?: string;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return src && !failed ? (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      loading={eager ? "eager" : "lazy"}
      className="catalog-art"
      onError={() => setFailed(true)}
    />
  ) : (
    <div className="art-placeholder" role="img" aria-label={alt}>
      <span>夢</span>
      <small>Kuroyume</small>
    </div>
  );
}
