// Updated 2026-09-14: Keep the group key in the fragment so bookmarks work without tab storage.
export function sharedToken(hash: string) {
  return hash.match(/^#\/join\/([a-f0-9]{64})(?:\/.*)?$/)?.[1] ?? '';
}

export function routeFromHash(hash: string) {
  return hash.replace(/^#/, '').replace(/^\/join\/[a-f0-9]{64}(?=\/|$)/, '') || '/';
}

export function bookmarkHash(token: string, hash: string) {
  const route = routeFromHash(hash);
  // Public pages must remain shareable without a group credential.
  if (route === '/new' || route === '/about') return `#${route}`;
  return `#/join/${token}${route === '/' ? '' : route}`;
}
