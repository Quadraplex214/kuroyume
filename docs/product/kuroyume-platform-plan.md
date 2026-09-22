# Kuroyume — a personal story atlas

Date: 2026-09-19. This supersedes the earlier homepage expansion roadmap. Research uses the RapidAPI website and direct REST requests, not MCP.

## Audit and product decisions

The existing app is a single route. One client component owns navigation, artwork, hardcoded search, collections, editorial sections, and footer. The only live data consists of four ranking cards. Bookmarks hold IDs without progress or metadata; all title links leave the app. Preserve the visual identity and editorial hero, but move full discovery, reading/watch tracking, and metadata into dedicated route experiences.

Kuroyume is a discovery and personal library product, not a streaming service or a replica of MAL's database screens. Its differentiators are mood-led entry points, a connected-story trail (recommendations and franchise relations), side-by-side comparison, and a library which remembers progress, notes, and recent exploration. Label scores as community scores, distinguish popularity from time-window trending, and never invent update timestamps or reading/streaming rights.

## REST research

Source: https://rapidapi.com/felixeschmittfes/api/myanimelist/playground/apiendpoint_df7df34c-2e4a-4231-a9e2-8d76c6445333

The supplied URL is specifically the Manga Genres endpoint (`GET /v2/manga/genres`). Browser inspection shows nine anime and eight manga operations: detail, search, top rankings, recommendation feed, recommendations by title, review feed, reviews by title, genres, plus seasonal anime. Direct REST probes are recorded in `docs/research/rapidapi-rest-evaluation.json`.

Confirmed REST shapes:
- `/anime/{id}` and `/manga/{id}`: original/English titles, alternative titles, synopsis, cover, information, statistics, characters. Anime information contains studios, genres, duration, rating, broadcast, status, episode count; manga contains publishing information and chapter/volume counts. Some nested URLs are malformed; reconstruct canonical title links from IDs.
- `/{medium}/top/{category}?p=`: array with MAL ID, cover, title, rank, score, format, members. Manga includes `manhwa`, anime includes airing/upcoming/popularity categories.
- `/v2/{medium}/search?q=&n=&score=&genre=`: compact array; no score or format in tested results, no documented paging/year/status/studio filters. Do not fabricate omitted values.
- `/v2/{medium}/genres`: ID, title, and amount.
- `/v2/anime/seasonal?year=&season=`: groups by format. Use RapidAPI first after verifying the winter 2025 response: older premiere dates also represent continuing series, not necessarily incorrect season assignments. Flatten format groups, deduplicate IDs, and paginate locally; use Jikan as fallback.
- `/v2/{medium}/recommendations/{id}`: recommendation pairs and explanation text. Suitable for related discovery, not algorithmic personalization claims.
- Reviews need contract validation and spoiler handling before integrating. Do not block title pages on reviews.

The tested RapidAPI subscription reported request limit 100 and 84 remaining; the headers observed do not establish its reset interval. Never generalize this to the provider's universal limit. Use conservative caching and no automated crawl. Jikan's first detail request succeeded; a manhwa query returned upstream 504, demonstrating that fallback and visible service errors are necessary.

See `docs/research/complementary-apis.md` for sourced authentication, limits, terms, and provider comparisons. Minimum integration: RapidAPI + Jikan. Do not connect AniList without resolving its tracking-product terms. No TMDB/YouTube Data API keys are needed for this release.

## Information architecture

- `/` — compact discovery hub: editorial feature, live popular/airing/manhwa previews, mood entry points, recently viewed. Links lead to dedicated routes.
- `/anime`, `/manga`, `/manhwa` — format-specific browse pages, category navigation and paged ranking results.
- `/discover` — URL-driven global search, medium/manhwa, genres, year, status, format, minimum score, popularity/score/date ordering. Advanced filters run at provider level, not just over a displayed page. Unsupported combinations are normalized and disabled or omitted.
- `/season/[year]/[season]` — seasonal exploration with previous/next navigation and native year/season controls. A season browser, not a falsely precise episode calendar.
- `/anime/[id]`, `/manga/[id]` — substantial detail pages: overview, stats, facts, genres/studios, trailer link if supplied, related-story map/list, recommendations, cast links, source links, library controls. Manhwa is a manga format, preserving canonical MAL IDs.
- `/character/[id]`, `/person/[id]`, `/studio/[id]` — focused exploration: profile, roles/works where provider supplies them. Load as needed rather than request all staff details on every anime page.
- `/genre/[slug]` — curated genre entry point leading to filtered discovery; genre IDs remain medium-scoped.
- `/recommendations` — choose a seed title, explore supported similar titles, follow links into the next seed. No suggestion that a generic feed is personalized.
- `/compare` — at most two selected titles, key facts and personal-library context.
- `/library` — one useful home for watchlist, reading, completed, favorites, collections, notes, progress, recently viewed, and local statistics. Use tabs/filters rather than six redundant routes.
- `/about` — identity, source attribution, local-data behavior and limitations.

Do not create dead-end account/profile/login pages. The first library is explicitly on-device, with export/import. Authenticated profiles and cross-device syncing are a separate deployment phase requiring configured auth and database services. Plan a `users / library_entries / collections / collection_entries` model keyed by user plus medium/ID. Never trust a client-submitted user ID for authorization.

## Architecture

- Root layout owns shared navigation/footer and metadata. Routes own their own loading/error/not-found behavior; no duplicate route groups needed for the first release.
- `lib/catalog/types.ts`: source-independent title summaries/details and result envelopes.
- `lib/catalog/normalize.ts`: validate/normalize RapidAPI and Jikan payloads, safe URLs, numeric values, and canonical IDs. It must be usable in unit tests without Next's server runtime.
- `lib/catalog/client.ts`: server-only allowlisted transport, credential isolation, timeout, short rate-limit cooldown, Jikan request pacing, validated response caching. No arbitrary upstream URL proxy.
- `lib/catalog/service.ts`: provider composition: RapidAPI rankings/basic metadata; Jikan advanced discovery and rich metadata. Fallback data is labelled and errors remain distinguishable from empty results.
- `components/catalog/`: shared cover, title card/grid, filter form, paging, section header and error state.
- `components/site/`: route-aware header/footer.
- `components/title/`: details and enrichment sections.
- `lib/library/` and `components/library/`: versioned local library store, legacy bookmark migration, small interactive controls, persistence warning, import/export and history.
- Query parameters are search state. React server components fetch public metadata. Only library, menu, carousel, and comparison selection need client state.
- Cache successful public rankings/search for 1 hour / 5 minutes, details for 24 hours, genres for 7 days. Deduplicate metadata and page calls through React cache. Validate before storing successful payloads. Upstream 429/timeout returns a user-facing retry state; never cache it as an empty success.
- Lazy load non-essential imagery and enrichment; do not eagerly fetch detail for every card. All public keys remain in `.env.local` server code. Skip blanket prefetch for expensive detail-card links.
- Dynamic title metadata and OG cover previews, robots rules excluding private/query utility pages, accessible landmarks/focus/reduced-motion support. No production canonical hostname invented; configure metadataBase and canonical URLs when the production origin is known.

## Phased implementation in this task

1. **Foundation and contracts:** implement typed adapters, normalizers and meaningful unit tests; shared navigation and state/error primitives. Preserve existing local data.
2. **Connected catalog:** homepage becomes hub; add anime/manga/manhwa browsing, discover filters, genre routes, paging, real internal detail pages and metadata.
3. **Story atlas:** recommendations and related titles; season exploration; character/person/studio destinations; bounded two-title comparison.
4. **Personal library:** statuses, progress, ratings, favorites, notes, named collections, recently viewed, export/import, local statistics. Use a clear on-device label and no fake login.
5. **Verification:** lint, type/build, fixture tests, direct route/render checks and browser flows at mobile and desktop widths; exercise unavailable provider, invalid IDs, empty search, history, persistence, and routing.

After this release, add authentication and database-backed sync only when a provider is configured, and consider region-aware streaming links via TMDB only when that feature is worth another data dependency. Defer live episode calendars, news ingestion, public social profiles, and streaming/reading content because this integration does not establish their reliability or rights.

## Test priorities

- Numeric strings, missing scores, malformed provider records, duplicate MAL IDs across media, application errors in HTTP 200.
- Genre and format fidelity; query preserved across page changes; valid manhwa results; no client-side fake global filters.
- Invalid IDs/years/pages, 404 versus provider outage, safe external URLs, no credentials in bundled client code.
- Library migration, corrupt storage, denied/full storage, merge import, unknown episode totals, duplicate compare selection.
- Touch/keyboard interactions, responsive long titles/navigation, no horizontal overflow, no motion dependency.

## Implementation notes

The phases above are implemented as connected routes and an on-device library. The response cache and Jikan request pacing are process-local, bounded, and reset on restart; a multi-instance deployment needs shared cache/rate-limit coordination. Live checks confirmed Jikan upstream 504s on several profile and filtered-search endpoints. These are explicitly unavailable states, not empty successful results. RapidAPI seasonal and manhwa ranking paths reduce unnecessary dependence on those endpoints. Cloud authentication/sync remains a follow-on phase.

