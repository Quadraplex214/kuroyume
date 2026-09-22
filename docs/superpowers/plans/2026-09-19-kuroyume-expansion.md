# Kuroyume Website Expansion Plan

**Status:** Proposed architecture and phased roadmap. The rebrand is implemented; the features below are planned, not implemented.
**Checked:** 2026-09-19
**Goal:** Turn the current discovery homepage into a connected anime, manga, and manhwa discovery and personal-tracking platform.
**Architecture:** Keep Next.js App Router. Render catalog data on the server through a typed, cached RapidAPI adapter. Use small client components for filters, collections, progress, and spoiler controls. Use MCP for capability discovery and development probes, rather than placing an MCP connection or credentials in the browser.
**Tech stack:** Existing Next.js 16.3.3, React 19, TypeScript, Tailwind CSS 4, and Lucide. Add test infrastructure with the first data-adapter feature; no new production dependency is necessary for the rebrand.
**Brief:** The user's request is to rebrand to Kuroyume, inspect the provided MyAnimeList MCP, and plan a richer website. This document proposes the feature scope for review; it does not authorize implementing every phase.

## 1. What is available today

The site has one homepage, eight curated discovery titles, local title/genre filtering, local saved collections, a three-story hero, an editorial shelf, and four live community rankings. Title links currently leave the app for MyAnimeList. There are no internal title pages, catalog-wide search, accounts, progress tracking, or reader/player.

The rebrand updates both wordmarks, accessible home-link names, browser metadata, and a K monogram app icon. The seal changes to 夢. Collection writes use `kuroyume-saved`; reads fall back to `kura-saved`, so existing bookmarks survive. The coral/charcoal/ivory visual direction remains intact.

## 2. Verified MCP capabilities

Successfully initialized `https://mcp.rapidapi.com` against `myanimelist.p.rapidapi.com` using the existing server-side local credential. The MCP is not installed as a persistent Codex tool; discovery and probes used direct MCP JSON-RPC requests. No global MCP configuration or API credential was changed.

The server advertised **17 tools**. Eight tools were invoked: seven returned relevant data; the manga-specific review tool returned an application error. Discovery is stronger evidence than guessing routes, but an advertised tool is not a reliability guarantee.

| Tool | What it enables | Evidence |
| --- | --- | --- |
| `Search_Animes` | Anime search with query, limit, minimum score, genre IDs | Called successfully |
| `Search_Mangas` | Manga search with the same filters | Called successfully; Solo Leveling found |
| `Get_Anime` | Synopsis, alternative titles, information, statistics, characters, cover | Called successfully for Frieren |
| `Get_Manga` | Manga details including format, chapters, volumes, status | Called successfully for Solo Leveling; identifies it as Manhwa |
| `Get_Top_Animes` | Overall, airing, upcoming, TV, movie, OVA, ONA, special, popularity, favorites | Advertised; existing REST overall rankings already work |
| `Get_Top_Mangas` | Overall, manga, oneshot, doujinshi, light novel, novel, manhwa, manhua, popularity, favorites | Called successfully with `category=manhwa`; 50 results |
| `Get_Seasonal_Animes` | Year/season discovery, grouped by format | Returned data, but seasonal correctness needs validation |
| `Get_Anime_Genres` | Anime genre IDs, names, title counts | Advertised; not invoked |
| `Get_Manga_Genres` | Manga genre IDs, names, title counts | Advertised; not invoked |
| `Get_Anime_Recommendations` | Feed of anime recommendation pairs | Advertised; 100 recommendations per page documented |
| `Get_Manga_Recommendations` | Feed of manga recommendation pairs | Advertised; 100 recommendations per page documented |
| `Get_Anime_Recommendations_by_Anime` | “If you liked this” recommendations for a title | Called successfully for Frieren |
| `Get_Manga_Recommendations_by_Manga` | Manga recommendations for a title | Advertised; not invoked |
| `Get_Anime_Reviews` | Recent anime reviews with tag and spoiler filters | Advertised; not invoked |
| `Get_Manga_reviews` | Recent manga reviews with tag and spoiler filters | Advertised; exact capitalization matters |
| `Get_Anime_Reviews_by_Anime` | Reviews for one anime, sorting and filtering | Advertised; not invoked |
| `Get_Anime_Reviews_by_Manga` | Intended manga-specific reviews | Called, but returned `Internal Server Error` |

The exact input schemas are saved in [the capability inventory](../../research/myanimelist-mcp-tools.json). Probe arguments and outcomes are in [the probe report](../../research/myanimelist-mcp-probes.json). Neither file contains credentials.

### Contract limitations that affect the product

- Search returns title, description, cover, URL, and ID. The tested search results did not contain score or format. Do not render fabricated scores or fetch details for every search tile just to add badges.
- Search supports `q`, `n` (1–50), `score` (0–10), and comma-separated `genre` IDs. It advertises **no pagination, sort, publication-status, or format filter**. Show up to 50 matches and prompt users to refine; do not promise unlimited search pages.
- Ranking and review tools expose page numbers. Stop load-more on an empty page; do not assume total counts or a `hasNextPage` field without checking responses.
- Manhwa is supported as a manga ranking category and a detail format, not as a separate search tool. The Manhwa landing page can be accurate immediately. Dedicated format-filtered global search needs a validated strategy; do not classify a title from its name or image.
- The seasonal probe explicitly requested summer 2026, but its first item carried a 2026-10-02 date. This does not establish whether the provider ignored the season, returned an unusual schedule, or supplied stale data. Gate seasonal launch on multiple season checks. Do not build an episode countdown from this response.
- Detail fields contain mixed strings, arrays, nulls, and numbers represented as text. Some anime detail URLs repeat the hostname. Build canonical title links from the known medium and ID; validate any other external link before displaying it.
- The manga-specific review tool advertises `/v2/anime/reviews/{manga_id}` despite describing manga. Its live call returned `{message: "Internal Server Error"}` with MCP `isError=false`. Treat this as unavailable, and detect application-level errors separately from HTTP/MCP success.
- Some schema defaults are lists of possible values, not valid single selections. Pass explicit categories and sort values. Set search limit, score, and review spoiler policy explicitly; do not inherit surprising defaults.

## 3. Recommended navigation and page structure

Keep the primary header small: **Discover · Anime · Manga · Manhwa · My collection**, with global search. Put rankings and seasons inside the corresponding browse pages and a secondary Discover menu rather than crowding the masthead.

| Route | Purpose and principal features | Data source |
| --- | --- | --- |
| `/` | Curated featured story; popular now; manhwa spotlight; editor's shelf; saved-title recommendation preview | Curated data + rankings + recommendation endpoints |
| `/search?q=&medium=&genre=&score=` | Shareable search, Anime/Manga tabs, genre chips, minimum score, clear filters, informative empty/error states | Search + genre tools |
| `/anime` | Ranked shelves for airing, upcoming, movies, and favorites; link to seasons | Anime rankings |
| `/manga` | Manga rankings, curated genres, editor collections, community favorites | Manga rankings + genres |
| `/manhwa` | Dedicated top-manhwa catalog and editorial selections | Manga rankings with `category=manhwa` |
| `/anime/[id]` | Art-led title page, synopsis, metadata, score, characters, collection action, recommendations, supported reviews | Anime details + per-title recommendations + reviews |
| `/manga/[id]` | Shared manga/manhwa detail route, format badge, chapters/volumes, authors when supplied, recommendations | Manga details + per-title recommendations; reviews gated |
| `/rankings?medium=&category=&page=` | Rank, community score, popularity/favorites categories, paged browsing | Top anime/manga tools |
| `/seasons/[year]/[season]` | Seasonal exploration, format groups, previous/next season | Seasonal tool; gated until correctness checks pass |
| `/discover` | Genre discovery, mood collections, community recommendation pairs, surprise-me within loaded results | Genres + recommendation feeds + editorial rules |
| `/collection` | Planned / Watching / Reading / Completed / On hold / Dropped, progress, personal score, notes | Local app-owned state initially |

Use medium plus numeric ID as the stable identity. A manhwa keeps a `/manga/[id]` URL and a `format: "manhwa"` field. Do not duplicate it under a competing detail route.

### Homepage order

1. Preserve the cinematic editorial hero with a direct internal title link and a discovery CTA.
2. Show a modest popular-now shelf from `bypopularity`, labelled **Popular**, not “trending today” because the API does not establish a time-window trend.
3. Add a real manhwa spotlight sourced from the supported ranking category.
4. Retain the ivory editor's shelf as an intentional visual break.
5. Show “Because you saved…” only when a saved title has supported recommendation data; otherwise show curated discovery.
6. Offer genre/mood entry points and a compact community ranking preview.
7. Surface collection progress for returning visitors without pushing discovery below a dashboard.

Mood labels are Kuroyume editorial mappings, not API-native emotion filters. Explain the mapping through the resulting genres or collection description. Avoid inventing personalization claims for a generic list.

## 4. Code and data architecture

```text
app/
  layout.tsx                        Global brand, fonts, metadata
  (site)/layout.tsx                  Shared header/footer for future routes
  (site)/page.tsx                    Homepage server composition
  (site)/search/page.tsx             URL-driven search
  (site)/anime/page.tsx              Anime shelves
  (site)/manga/page.tsx              Manga shelves
  (site)/manhwa/page.tsx             Manhwa rankings and editorial content
  (site)/anime/[id]/page.tsx         Anime details and metadata
  (site)/manga/[id]/page.tsx         Manga/manhwa details and metadata
  (site)/rankings/page.tsx            Paged rankings
  (site)/seasons/[year]/[season]/page.tsx
  (site)/discover/page.tsx
  (site)/collection/page.tsx
components/
  site/brand.tsx, header.tsx, footer.tsx
  home/featured-story.tsx, editorial-shelf.tsx, mood-picker.tsx
  catalog/title-card.tsx, title-grid.tsx, filter-bar.tsx, search-form.tsx
  title/title-header.tsx, metadata.tsx, recommendation-rail.tsx, reviews.tsx
  collection/collection-button.tsx, progress-editor.tsx
lib/
  mal/client.ts                     Server-only credentialed transport
  mal/types.ts                      Normalized public types
  mal/normalize.ts                  Runtime checks and provider-shape conversion
  mal/catalog.ts                    Search, genres, rankings, seasons
  mal/details.ts                    Details, recommendations, supported reviews
  editorial.ts                      Static curated selections and mood mappings
  collection/store.ts               Versioned local store and migrations
  collection/types.ts              Status, progress, notes, personal score
```

Split the current broad `components/hero.tsx` along these responsibilities as each route ships. Migrate `app/page.tsx` into the route group once; do not leave two pages resolving to `/`. Keep API secrets exclusively in the server module and import `server-only`. Server Components should call the adapter directly. Use route handlers only if a client interaction actually needs an HTTP boundary, and restrict them to explicit supported operations—never build an arbitrary upstream URL proxy.

### Contracts

```ts
type Medium = "anime" | "manga";
type TitleKey = `${Medium}/${number}`;
type CatalogTitle = {
  id: number;
  medium: Medium;
  title: string;
  imageUrl: string | null;
  score: number | null;
  format: string | null;
};
type LoadResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: "unavailable" | "rate-limited" | "invalid-data" | "not-found" };
type SearchInput = {
  medium: Medium; q: string; limit: number; minimumScore: number; genreIds: number[];
};
// First adapter interfaces:
// searchTitles(input: SearchInput): Promise<LoadResult<CatalogTitle[]>>
// getTitle(medium: Medium, id: number): Promise<LoadResult<TitleDetail>>
// getRankings(medium: Medium, category: string, page: number): Promise<LoadResult<CatalogTitle[]>>
// TitleDetail extends CatalogTitle with normalized synopsis, information, statistics,
// and characters; finalize those nested types against fixtures in Phase 1.
```

Do not assert a fully trusted TypeScript type on arbitrary JSON. Validate required identity/title fields, map absent scores to null, and reject payload-level error objects. Keep partial pages useful when a recommendations or reviews section fails.

### Operational choices

- Keep the current 8-second timeout. Cache rankings for 1 hour, detail data for 24 hours, genre lists for 7 days, search for 5 minutes, and recommendation/review feeds for 1 hour initially. Revisit after learning the subscription limits.
- Use submitted search initially; if adding live suggestions, debounce by 350 ms, require two characters, cancel stale requests, and cap suggestions. Do not query on every keystroke.
- Respect 429 responses; show retry guidance and available cached content without retry storms. Do not cache an error as an empty successful catalog for an hour.
- Validate numeric IDs, season names, years, query length, category allowlists, and page bounds before fetching. Derive allowed genres from the corresponding medium's catalog.
- Keep seasonal, review, and future recommendation failures isolated by section-level loading/error UI.
- Render provider text as text, not raw HTML; decode/sanitize formatting artifacts. Reviews remain spoiler-hidden until the user opts in. Never equate an absent spoiler flag with a guarantee of no spoilers.
- Use approved HTTPS image hosts and resilient cover placeholders. Build canonical MAL title links locally from IDs.
- Store no credentials in browser bundles, JSON fixtures, logs, or MCP configuration committed to Git. The existing `.env.local` remains the server credential location.

## 5. Delivery sequence and acceptance checks

Each phase produces a usable release. Plan the account subsystem separately if cross-device sync becomes a priority.

### Phase 1 — Make discovery a connected product (recommended next)

**Files:** Create `lib/mal/{client,types,normalize,catalog,details}.ts`, `components/site/*`, `components/catalog/*`, title and search routes from the tree above. Modify the homepage and current `lib/mal.ts` consumers to use the shared adapter.

- [ ] Establish fixture-based adapter tests before changing data flows. Cover search without score/type; an empty English title falling back to the original title; unknown episode/chapter counts; payload-level error messages; timeout/429; malformed external URLs; and anime/manga ID collisions.
- [ ] Implement the server-only adapter and migrate existing rankings. Verify no request sends credentials to a host other than the configured allowlisted API host.
- [ ] Add internal anime and manga detail pages. Test positive integer IDs, a missing title, title fallback, save/remove, and partial failure of secondary sections.
- [ ] Add submitted catalog-wide search with URL state and Anime/Manga tabs. Test reload, browser back/forward, empty query, no matches, special characters, and the 50-result limit. Preserve a clearly labelled local curated filter on the homepage or replace it with the global form.
- [ ] Add Manhwa browse using the confirmed ranking category. Test that it uses manga identities and correct format labels, not a guessed third API medium.
- [ ] Extract a shared brand/header/footer and replace external card navigation with internal title routes. Retain a visible “View on MyAnimeList” link on detail pages.
- [ ] Run adapter tests, `pnpm lint`, `pnpm build`, and desktop/mobile browser flows. Release when a visitor can search, open a title, save it, and browse manhwa without leaving Kuroyume.

### Phase 2 — Make returning worthwhile

**Files:** `lib/collection/{types,store}.ts`, `components/collection/*`, collection route, `components/title/recommendation-rail.tsx`, homepage recommendation preview.

- [ ] Introduce a versioned collection envelope with title key, status, episode/chapter progress, optional personal score and notes, and update timestamp. Migrate both previous bookmark keys without deleting their data until the new write succeeds.
- [ ] Add collection filters and progress editing. Clamp to known totals only; allow progress on titles with unknown totals. Keep changes usable if storage is disabled or full, and announce when persistence fails.
- [ ] Add explicit JSON export/import with schema validation and merge preview so a local collection is portable. Test malformed JSON, duplicate keys, older versions, and collision resolution.
- [ ] Add per-title recommendations, deduplicate by medium/ID, and derive a small “Because you saved…” shelf from a bounded number of seeds. Avoid saved/completed recommendations where appropriate; state the seed title visibly.
- [ ] Verify legacy migration, reload persistence, multiple tabs, empty collections, storage failure, and recommendation service failure. Do not describe local state as a synced account.

### Phase 3 — Broader exploration and community context

**Files:** Rankings, Discover, and gated Seasons routes; catalog adapter functions; review component.

- [ ] Verify genre and feed tool responses, then add genre discovery and ranking category/page controls. Treat editorial mood mappings as curated content.
- [ ] Compare responses for two known historical seasons and the requested current season. Confirm that parameters materially change results and inspect inconsistent dates. Ship the season browser only after that check; keep calendar/countdown features out of scope.
- [ ] Probe anime reviews and manga-wide reviews with explicit spoiler and tag settings. Render short attributed excerpts and links; review display/reuse requirements before release.
- [ ] Resolve the broken manga-specific review contract with the provider or keep that section unavailable. Do not guess an unadvertised replacement endpoint in production.
- [ ] Verify pagination termination, no duplicate titles across ranking pages, spoiler controls, rate limiting, and accessible loading/error states.

### Phase 4 — Optional, separately scoped

Accounts, cross-device syncing, shareable collections, notifications, and social features require Kuroyume-owned persistence and authentication. The discovered MCP exposes no account/list mutation tools. MAL account synchronization would require a separate verified integration and authorization flow. These features should not delay Phases 1–2.

## 6. Features this MCP does not establish

No discovered tool provides video playback, manga page images, chapter reading, live chapter-release feeds, reliable per-episode release times, legal streaming availability, authentication, MAL list writes, or push notifications. A total chapter count in a title response is not a new-chapter feed. Frame Kuroyume as discovery and tracking; add licensed reading/watching or release feeds only with a separate data/content source.

## 7. Design and review constraints

Retain the cinematic hero, warm editorial contrast, consistent cards, responsive typography, keyboard-visible focus, and reduced-motion handling. Verify widths of 320, 390, 768, and 1440 pixels. Keep essential title/actions visible without hover. Keep the longer Kuroyume wordmark clear of navigation.

Most important review risks: provider payload errors hidden inside successful responses; genre/type/season defaults that silently alter results; hydration and collection migration losing data; spoilers in provider text; and a burst of detail/recommendation requests exhausting API quota. The owning phase above includes a verification step for each.

**Recommended next delivery:** Phase 1 only—internal title pages, real search, and a dedicated manhwa catalog. It makes the current design a useful connected product and gives later tracking/recommendation work stable data contracts.
