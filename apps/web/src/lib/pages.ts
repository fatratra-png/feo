/**
 * Page chunks, loaded on demand. The same import functions feed React.lazy and
 * the prefetcher, so a prefetched page renders instantly (no blank Suspense).
 */
export const pages = {
  search: () => import('../pages/Search'),
  library: () => import('../pages/Library'),
  create: () => import('../pages/Create'),
  collections: () => import('../pages/Collections'),
  auth: () => import('../pages/Auth'),
};

const byPath: [prefix: string, page: keyof typeof pages][] = [
  ['/search', 'search'],
  ['/library', 'library'],
  ['/create', 'create'],
  ['/liked', 'collections'],
  ['/playlist', 'collections'],
  ['/mix', 'collections'],
];

/** Starts loading the chunk behind a path (hover, focus, touch on a link). */
export function prefetchPath(path: string) {
  const hit = byPath.find(([prefix]) => path.startsWith(prefix));
  if (hit) pages[hit[1]]().catch(() => undefined);
}

/** Loads every in-app page once the browser is idle after the first paint. */
export function prefetchAppPages() {
  const run = () => {
    for (const key of ['search', 'library', 'create', 'collections'] as const) pages[key]().catch(() => undefined);
  };
  if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 1500 });
  else setTimeout(run, 1200);
}
