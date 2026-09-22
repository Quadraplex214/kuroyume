import Link from "next/link";
export const metadata = { title: "About Kuroyume" };
export default function Page() {
  return (
    <div className="page-width platform-page about-page">
      <div className="page-intro">
        <p className="eyebrow coral">FOR THE ENDLESSLY CURIOUS</p>
        <h1>
          Stories are better
          <br />
          <em>when you find your own.</em>
        </h1>
        <p>
          Kuroyume is a personal story atlas for anime, manga, and manhwa. A
          place to discover, follow connections, and keep the stories that
          matter to you.
        </p>
      </div>
      <div className="about-grid">
        <section>
          <h2>Follow a feeling.</h2>
          <p>
            Our mood collections are editorial starting points. The
            connected-story atlas brings together adaptations, sequels, studios,
            characters, and community recommendations. Popularity and scores are
            community signals, not a promise of what you’ll love.
          </p>
          <Link href="/discover">Find your next story ↗</Link>
        </section>
        <section>
          <h2>Your library stays yours.</h2>
          <p>
            Progress, notes, ratings, favorites, and collections are stored in
            this browser. There is no account or cloud sync. Export your library
            to keep a backup or move it to another device. Clearing browser
            storage removes local data.
          </p>
          <Link href="/library">Open your library ↗</Link>
        </section>
        <section>
          <h2>Built on community knowledge.</h2>
          <p>
            Catalog information and community scores come from MyAnimeList
            through RapidAPI and Jikan. Metadata may be incomplete or delayed.
            Cover artwork belongs to its creators and rights holders.
          </p>
          <div className="external-links">
            <a href="https://myanimelist.net" target="_blank" rel="noreferrer">
              MyAnimeList ↗
            </a>
            <a href="https://jikan.moe" target="_blank" rel="noreferrer">
              Jikan ↗
            </a>
            <a
              href="https://rapidapi.com/felixeschmittfes/api/myanimelist"
              target="_blank"
              rel="noreferrer"
            >
              RapidAPI ↗
            </a>
          </div>
        </section>
        <section>
          <h2>An atlas, not a player.</h2>
          <p>
            Kuroyume helps you find and track stories. It does not host episodes
            or manga pages. Trailer and streaming links open external services;
            access depends on your country and the provider.
          </p>
          <Link href="/recommendations">Follow a story trail ↗</Link>
        </section>
      </div>
    </div>
  );
}
