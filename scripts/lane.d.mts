export function laneNumber(cwd?: string, env?: Record<string, string | undefined>): number;
export function lanePorts(cwd?: string, env?: Record<string, string | undefined>): { dev: number; preview: number; e2e: number };
