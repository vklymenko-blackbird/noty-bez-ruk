// Computes the lane number and ports (SPEC section 7). Shared by config files.
import { basename } from 'node:path';

export function laneNumber(cwd = process.cwd(), env = process.env) {
  if (env.LANE && /^\d+$/.test(env.LANE)) return Number(env.LANE);
  const m = /lane(\d+)$/.exec(basename(cwd));
  return m ? Number(m[1]) : 0;
}
export function lanePorts(cwd, env) {
  const n = laneNumber(cwd, env);
  const base = 3200 + n * 10;
  return { dev: base, preview: base + 1, e2e: base + 2 };
}
