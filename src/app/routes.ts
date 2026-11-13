import type { ComponentType } from 'preact';
import type { ScreenProps } from '../contracts';
import LibraryScreen from '../screens/LibraryScreen';
import SearchScreen from '../screens/SearchScreen';
import ScoreScreen from '../screens/ScoreScreen';
import PlayScreen from '../screens/PlayScreen';
import SettingsScreen from '../screens/SettingsScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import DevHarness from '../screens/DevHarness';
import { isTestMode } from './testMode';
import { matchRoute } from './router';

export interface RouteDef {
  pattern: string;
  component: ComponentType<ScreenProps>;
  testOnly?: boolean;
}

export const ROUTES: RouteDef[] = [
  { pattern: '/', component: LibraryScreen },
  { pattern: '/search', component: SearchScreen },
  { pattern: '/score/:id', component: ScoreScreen },
  { pattern: '/play/:id', component: PlayScreen },
  { pattern: '/settings', component: SettingsScreen },
  { pattern: '/onboarding', component: OnboardingScreen },
  { pattern: '/dev/:what', component: DevHarness, testOnly: true },
  { pattern: '/dev/:what/:id', component: DevHarness, testOnly: true },
];

export interface Resolved {
  component: ComponentType<ScreenProps>;
  params: Record<string, string>;
  /** The path after fallback ("/" for unknown paths). */
  path: string;
}

export function resolveRoute(path: string): Resolved {
  for (const r of ROUTES) {
    if (r.testOnly && !isTestMode()) continue;
    const params = matchRoute(r.pattern, path);
    if (params) return { component: r.component, params, path };
  }
  return { component: LibraryScreen, params: {}, path: '/' };
}
