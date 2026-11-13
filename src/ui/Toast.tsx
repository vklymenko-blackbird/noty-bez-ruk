import { useEffect, useState } from 'preact/hooks';

export interface ToastOptions {
  kind?: 'info' | 'ok' | 'warn' | 'error';
  action?: { label: string; onClick(): void };
  durationMs?: number;
}
interface ToastItem extends ToastOptions {
  id: number;
  message: string;
}

let nextId = 1;
let items: ToastItem[] = [];
const listeners = new Set<(list: ToastItem[]) => void>();
const emit = () => listeners.forEach((l) => l(items));

function dismiss(id: number) {
  items = items.filter((i) => i.id !== id);
  emit();
}

/** Shows a toast. Returns a function that dismisses it. */
export function toast(message: string, opts: ToastOptions = {}): () => void {
  const id = nextId++;
  items = [...items, { ...opts, id, message }];
  emit();
  const ms = opts.durationMs ?? 4000;
  if (ms > 0) setTimeout(() => dismiss(id), ms);
  return () => dismiss(id);
}

export function clearToasts(): void {
  items = [];
  emit();
}

export function ToastHost() {
  const [list, setList] = useState<ToastItem[]>(items);
  useEffect(() => {
    listeners.add(setList);
    setList(items);
    return () => {
      listeners.delete(setList);
    };
  }, []);
  return (
    <div class="ui-toast-host" data-nav-ignore>
      {list.map((i) => (
        <div key={i.id} class={`ui-toast ui-toast--${i.kind ?? 'info'}`} role="status" data-testid="toast">
          <span>{i.message}</span>
          {i.action ? (
            <button type="button" class="ui-toast__action" onClick={() => { i.action?.onClick(); dismiss(i.id); }}>
              {i.action.label}
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
