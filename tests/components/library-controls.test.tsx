// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { SaveButton } from '@/components/library/controls';
import { migrateBookmarks } from '@/lib/library/model';

afterEach(() => { cleanup(); localStorage.clear(); });
test('saving a story persists it and a second click removes it', async () => {
  const title = migrateBookmarks(['anime/1']).entries['anime/1'].title;
  const user = userEvent.setup();
  render(<SaveButton title={title} />);
  await user.click(screen.getByRole('button', { name: `Save ${title.title}` }));
  expect(screen.getByRole('button', { name: `Remove ${title.title}` })).toHaveAttribute('aria-pressed', 'true');
  expect(JSON.parse(localStorage.getItem('kuroyume-library-v1')!).entries['anime/1']).toBeDefined();
  await user.click(screen.getByRole('button', { name: `Remove ${title.title}` }));
  expect(JSON.parse(localStorage.getItem('kuroyume-library-v1')!).entries['anime/1']).toBeUndefined();
});
