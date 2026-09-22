import "server-only";
import { obj } from "./normalize";

type Provider = "RapidAPI" | "Jikan";
type CacheState = {
  values: Map<string, { expires: number; value: unknown }>;
  nextJikan: number;
  cooldown: Record<Provider, number>;
  pending: Map<string, Promise<unknown>>;
};
const scope = globalThis as typeof globalThis & {
  kuroyumeCatalogLocal?: CacheState;
};
const state = (scope.kuroyumeCatalogLocal ??= {
  pending: new Map(),
  values: new Map(), nextJikan: 0, cooldown: { RapidAPI: 0, Jikan: 0 },
});
export class CatalogError extends Error {
  constructor(
    public kind: "unavailable" | "rate-limited" | "not-found" | "invalid-data",
  ) {
    super(kind);
  }
}

export async function request(
  provider: Provider,
  path: string,
  ttl = 3600,
): Promise<unknown> {
  if (!path.startsWith("/") || path.startsWith("//"))
    throw new CatalogError("invalid-data");
  const key = `${provider}:${path}`;
  const hit = state.values.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const pending = state.pending.get(key);
  if (pending) return pending;
  if (state.cooldown[provider] > Date.now()) throw new CatalogError("rate-limited");
  const promise = (async () => {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (provider === "RapidAPI") {
      if (!process.env.RAPIDAPI_KEY) throw new CatalogError("unavailable");
      headers["x-rapidapi-host"] = "myanimelist.p.rapidapi.com";
      headers["x-rapidapi-key"] = process.env.RAPIDAPI_KEY;
    }
    if (provider === 'Jikan') {
      const now = Date.now();
      const wait = Math.max(0, state.nextJikan - now);
      if (wait > 12000) throw new CatalogError('rate-limited');
      state.nextJikan = Math.max(now, state.nextJikan) + 1100;
      if (wait) await new Promise(resolve => setTimeout(resolve, wait));
    }
    const base =
      provider === "RapidAPI"
        ? "https://myanimelist.p.rapidapi.com"
        : "https://api.jikan.moe/v4";
    const response = await fetch(`${base}${path}`, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (response.status === 429) {
      const delay = Number(response.headers.get("retry-after"));
      state.cooldown[provider] = Date.now() + Math.min(300, Math.max(30, Number.isFinite(delay) ? delay : 60)) * 1000;
      throw new CatalogError("rate-limited");
    }
    if (response.status === 404) throw new CatalogError("not-found");
    if (!response.ok) throw new CatalogError("unavailable");
    const body: unknown = await response.json();
    if (
      body === null ||
      typeof body !== "object" ||
      obj(body).error ||
      obj(body).message
    )
      throw new CatalogError("invalid-data");
    if (state.values.size >= 500) state.values.delete(state.values.keys().next().value!);
    state.values.set(key, { value: body, expires: Date.now() + ttl * 1000 });
    return body;
  })();
  state.pending.set(key, promise);
  try {
    return await promise;
  } catch (error) {
    throw error instanceof CatalogError
      ? error
      : new CatalogError("unavailable");
  } finally {
    state.pending.delete(key);
  }
}
