import { uk } from './uk';

export type StringKey = keyof typeof uk;
export { uk };

/** Returns the Ukrainian string for `key`. Replaces `{name}` placeholders. */
export function t(key: StringKey, params?: Record<string, string | number>): string {
  const text: string = uk[key];
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in params ? String(params[name]) : whole));
}
