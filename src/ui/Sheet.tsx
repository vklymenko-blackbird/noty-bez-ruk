import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

/** A touch tap opens a sheet on pointerup. The click that follows lands on the new scrim and must not close it. */
const GHOST_CLICK_MS = 400;

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children?: ComponentChildren;
  class?: string;
  'data-testid'?: string;
}

/** Bottom sheet. Closes on scrim tap and Escape. Focus moves into it. */
export function Sheet({ open, onClose, title, children, class: cls, ...rest }: SheetProps) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const openedAt = useRef(0);

  useEffect(() => {
    if (!open) return;
    openedAt.current = performance.now();
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      prev?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div class="ui-sheet-scrim" data-testid="sheet-scrim" data-nav-ignore onClick={(e) => { if (e.target === e.currentTarget && performance.now() - openedAt.current > GHOST_CLICK_MS) onClose(); }}>
      <div ref={ref} class={`ui-sheet${cls ? ` ${cls}` : ''}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} data-testid={rest['data-testid'] ?? 'sheet'}>
        <div class="ui-sheet__grip" />
        {title ? <h2 class="ui-sheet__title">{title}</h2> : null}
        {children}
      </div>
    </div>
  );
}
