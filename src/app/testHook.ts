import type { PoseSample, ScoreId, Settings, StorageApi } from '../contracts';
import { settings } from '../settings';
import { storage } from '../storage';
import { getInjectedPoseSource } from '../pose';
import { navigate } from './router';
import * as pdf from '../pdf';
import * as paper from '../paper';
import * as pose from '../pose';
import * as gesture from '../gesture';
import * as annot from '../annot';
import * as sources from '../sources';
import * as library from '../library';
import * as input from '../input';
import * as wake from '../wake';
import * as play from '../play';

const probes = new Map<string, () => unknown>();

/** Screens and controllers call this to expose state to e2e tests. Pass null to remove. */
export function setProbe(name: string, read: (() => unknown) | null): void {
  if (read) probes.set(name, read);
  else probes.delete(name);
}

export interface NotyTest {
  pushPose(sample: PoseSample): void;
  replay(samples: PoseSample[]): void;
  getState(): Record<string, unknown>;
  addScore(base64Pdf: string, info: { title: string; composer?: string; pageCount: number }): Promise<ScoreId>;
  setSettings(patch: Partial<Settings>): void;
  storage: StorageApi;
  navigate(path: string): void;
  modules: {
    pdf: typeof import('../pdf');
    paper: typeof import('../paper');
    pose: typeof import('../pose');
    gesture: typeof import('../gesture');
    annot: typeof import('../annot');
    sources: typeof import('../sources');
    library: typeof import('../library');
    input: typeof import('../input');
    wake: typeof import('../wake');
    play: typeof import('../play');
  };
}

declare global {
  interface Window {
    __notyTest?: NotyTest;
  }
}

function fromBase64(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

export function installTestHook(): void {
  const hook: NotyTest = {
    pushPose: (s) => getInjectedPoseSource().push(s),
    replay: (samples) => getInjectedPoseSource().replay(samples),
    getState() {
      const out: Record<string, unknown> = {};
      for (const [name, read] of probes) {
        try {
          out[name] = read();
        } catch {
          out[name] = null;
        }
      }
      return out;
    },
    async addScore(base64Pdf, info) {
      const meta = await storage.addScore(
        {
          title: info.title,
          composer: info.composer,
          pageCount: info.pageCount,
          origin: { kind: 'file', sourceName: 'Файл', license: null, pageUrl: null, fileUrl: null },
        },
        fromBase64(base64Pdf),
      );
      return meta.id;
    },
    setSettings: (patch) => settings.set(patch),
    storage,
    navigate: (path) => navigate(path),
    modules: { pdf, paper, pose, gesture, annot, sources, library, input, wake, play },
  };
  window.__notyTest = hook;
}
