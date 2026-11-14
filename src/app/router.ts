import { useEffect, useState } from 'preact/hooks';

export interface Route {
  path: string;
  params: Record<string, string>;
}

/** Matches "/score/:id" against "/score/abc". Returns the params or null. */
export function matchRoute(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split('/').filter(Boolean);
  const s = path.split('/').filter(Boolean);
  if (p.length !== s.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    const part = p[i];
    const seg = s[i];
    if (part.startsWith(':')) {
      try {
        params[part.slice(1)] = decodeURIComponent(seg);
      } catch {
        return null;
      }
    } else if (part !== seg) {
      return null;
    }
  }
  return params;
}

function currentPath(): string {
  const h = location.hash;
  if (!h.startsWith('#')) return '/';
  const p = h.slice(1).split('?')[0];
  return p.startsWith('/') ? p : '/';
}

export function navigate(path: string, opts?: { replace?: boolean }): void {
  const hash = `#${path}`;
  if (opts?.replace) {
    const url = `${location.pathname}${location.search}${hash}`;
    history.replaceState(null, '', url);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    location.hash = hash;
  }
}

let navDepth = 0;
window.addEventListener('hashchange', () => {
  navDepth += 1;
});

/** Goes back in history when the app made a navigation, else to `fallback`. */
export function back(fallback: string): void {
  if (navDepth > 0 && history.length > 1) {
    navDepth -= 1;
    history.back();
  } else {
    navigate(fallback, { replace: true });
  }
}

export function useRoute(): Route {
  const [path, setPath] = useState(currentPath());
  useEffect(() => {
    const on = () => setPath(currentPath());
    window.addEventListener('hashchange', on);
    on();
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return { path, params: {} };
}
