"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Bookmark, Search, Menu, X } from "lucide-react";
const links = [
  ["Discover", "/discover"],
  ["Anime", "/anime"],
  ["Manga", "/manga"],
  ["Manhwa", "/manhwa"],
];
export function SiteHeader() {
  const pathname = usePathname();
  const [menu, setMenu] = useState(false);
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="site-header page-width">
        <Link href="/" className="brand" aria-label="Kuroyume home">
          <span className="brand-seal" aria-hidden="true">
            夢
          </span>
          <span>
            Kuroyume<span className="brand-dot">.</span>
          </span>
        </Link>
        <nav className="desktop-nav" aria-label="Primary navigation">
          {links.map(([label, href]) => (
            <Link
              key={href}
              className={pathname.startsWith(href) ? "nav-active" : ""}
              aria-current={pathname === href ? "page" : undefined}
              href={href}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="header-actions">
          <Link
            href="/discover"
            className="icon-button"
            aria-label="Search stories"
          >
            <Search size={19} />
          </Link>
          <span className="header-divider" />
          <Link
            href="/library"
            className="collection-button"
            aria-label="My library"
          >
            <Bookmark size={16} />
            <span>My library</span>
          </Link>
          <button
            className="icon-button mobile-menu"
            aria-label={menu ? "Close navigation" : "Open navigation"}
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X /> : <Menu />}
          </button>
        </div>
        {menu && (
          <nav className="mobile-nav" aria-label="Mobile navigation">
            {[
              ...links,
              ["My library", "/library"],
              ["Recommendations", "/recommendations"],
              ["Compare", "/compare"],
            ].map(([label, href]) => (
              <Link key={href} href={href} onClick={() => setMenu(false)}>
                {label}
              </Link>
            ))}
          </nav>
        )}
      </header>
    </>
  );
}
export function SiteFooter() {
  return (
    <footer className="site-footer page-width">
      <Link href="/" className="brand">
        <span className="brand-seal">夢</span>
        <span>
          Kuroyume<span className="brand-dot">.</span>
        </span>
      </Link>
      <p>A home for the stories that stay.</p>
      <div>
        <Link href="/about">About & data sources ↗</Link>
        <Link href="/library">Your library, your pace ↗</Link>
      </div>
    </footer>
  );
}
