# Kuroyume

An anime, manga, and manhwa discovery platform built with Next.js App Router, React, TypeScript, and Tailwind CSS.

## Local development

Use Node.js 24 and pnpm 11.5.2 (pinned in package.json).

```sh
pnpm install --frozen-lockfile
# Copy .env.example to .env.local and set RAPIDAPI_KEY.
pnpm dev
```

The catalog uses MyAnimeList through RapidAPI, with Jikan for enrichment. RAPIDAPI_KEY stays server-side; never use a NEXT_PUBLIC_ prefix. The provider host is fixed in the server client. Jikan requires no credentials. No database, SMTP service, or authentication configuration is needed.

## Storage and features

The existing discovery, seasonal, detail, character, person, studio, genre, recommendation, comparison, and library pages are preserved. This platform does not host video or manga chapters.

Libraries are private to the browser/device, using versioned localStorage (kuroyume-library-v1). Legacy bookmarks migrate automatically. Progress, ratings, favorites, notes, collections, recently viewed titles, and JSON import/export work without an account. There is no cloud sync. Export before clearing browser storage or switching devices/domains; localhost libraries do not automatically appear on a deployed domain.

Public provider responses use a bounded, process-local TTL cache (maximum 500 entries). Concurrent identical requests are deduplicated; Jikan requests are paced and upstream 429 responses trigger cooldowns. Cache and rate coordination reset with each server instance and are not shared across Vercel instances. Monitor your provider quota as traffic grows; persistent shared caching is deferred with the database work.

## Vercel configuration

- Import the repository using the Next.js framework preset; repository root is the project root.
- Node.js: 24.x. Install: pnpm install --frozen-lockfile. Build: pnpm build. Leave the output directory at the framework default.
- Set RAPIDAPI_KEY as a server-side environment variable in each intended environment. Use an active subscription to the MyAnimeList RapidAPI product.
- Do not configure static export: live catalog pages need server execution.
- No vercel.json, database migrations, or custom server are required.
- Without a provider key, affected shelves show their existing unavailable state; curated content and guest libraries still work.

Runtime artwork under public/artwork and source files must be included in the repository. Local environment files, build output, dependencies, and private data are ignored. Previously created .postgres and .backups directories are deliberately preserved, ignored, and unused by the application. Do not upload them manually.

## Validation

```sh
pnpm check                 # unit/component tests, lint, production build, client secret scan
pnpm exec tsc --noEmit     # after build generates route types
pnpm exec playwright install chromium
pnpm test:e2e              # production-build desktop/mobile server on port 3100
```

Vitest covers catalog normalization, request caching/errors, library validation, and save controls. Playwright checks navigation, library reloads, hydration warnings, and mobile overflow without a database. Run the production build before browser tests. Playwright starts its own production server on port 3100 and refuses to reuse an existing server. GitHub Actions runs these checks. Test reports and coverage remain ignored. The client-bundle scan checks configured secrets without printing them.

## Background

- [Platform architecture and API evaluation](docs/product/kuroyume-platform-plan.md)
- [Complementary API research](docs/research/complementary-apis.md)
- [Artwork provenance](public/artwork/README.md)

Research and original planning documents describe possible future work; they are not claims that deferred account or database features are present.
