import { afterEach, expect, test, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { request } from '../lib/catalog/client';
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
test('successful responses are cached and identical concurrent requests share one fetch', async () => {
  vi.stubEnv('RAPIDAPI_KEY', 'unit-test-only');
  const fetch = vi.fn(async () => Response.json({ data: [1] }));
  vi.stubGlobal('fetch', fetch);
  const responses = await Promise.all([request('RapidAPI', '/cache-test'), request('RapidAPI', '/cache-test')]);
  expect(responses).toEqual([{ data: [1] }, { data: [1] }]);
  expect(await request('RapidAPI', '/cache-test')).toEqual({ data: [1] });
  expect(fetch).toHaveBeenCalledTimes(1);
});
test('upstream error payloads are not cached and a later request can recover', async () => {
  vi.stubEnv('RAPIDAPI_KEY', 'unit-test-only');
  const fetch = vi.fn().mockResolvedValueOnce(Response.json({ error: 'failure' })).mockResolvedValueOnce(Response.json({ data: [] }));
  vi.stubGlobal('fetch', fetch);
  await expect(request('RapidAPI', '/invalid-test')).rejects.toMatchObject({ kind: 'invalid-data' });
  expect(await request('RapidAPI', '/invalid-test')).toEqual({ data: [] });
  expect(fetch).toHaveBeenCalledTimes(2);
});
test('upstream 429 prevents further requests during the process cooldown', async () => {
  const fetch = vi.fn(async () => new Response('{}', { status: 429, headers: { 'retry-after': '120' } }));
  vi.stubGlobal('fetch', fetch);
  await expect(request('Jikan', '/rate-limit-test')).rejects.toMatchObject({ kind: 'rate-limited' });
  await expect(request('Jikan', '/another-title')).rejects.toMatchObject({ kind: 'rate-limited' });
  expect(fetch).toHaveBeenCalledTimes(1);
});
test('invalid paths and absent credentials do not call the provider', async () => {
  vi.stubEnv('RAPIDAPI_KEY', '');
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  await expect(request('RapidAPI', '//example.com')).rejects.toMatchObject({ kind: 'invalid-data' });
  await expect(request('RapidAPI', '/missing-key')).rejects.toMatchObject({ kind: 'unavailable' });
  expect(fetch).not.toHaveBeenCalled();
});
