import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

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
  /**
   * True when the last pointerdown started on the scrim itself. A touch tap can open a sheet on pointerup;
   * the click that follows lands on the new scrim without any pointerdown on it, so it never closes the sheet.
   * There is no time window: only a press that really started on the scrim closes it.
   */
  const pressed = useRef(false);

  useEffect(() => {
    if (!open) return;
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

  const onScrimDown = (e: PointerEvent) => {
    pressed.current = e.target === e.currentTarget;
  };
  const onScrimCancel = () => {
    pressed.current = false;
  };
  const onScrimClick = (e: MouseEvent) => {
    const real = pressed.current;
    pressed.current = false;
    if (real && e.target === e.currentTarget) onClose();
  };

  if (!open) return null;
  return (
    <div class="ui-sheet-scrim" data-testid="sheet-scrim" data-nav-ignore onPointerDown={onScrimDown} onPointerCancel={onScrimCancel} onClick={onScrimClick}>
      <div ref={ref} class={`ui-sheet${cls ? ` ${cls}` : ''}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} data-testid={rest['data-testid'] ?? 'sheet'}>
        <div class="ui-sheet__grip" />
        {title ? <h2 class="ui-sheet__title">{title}</h2> : null}
        {children}
      </div>
    </div>
  );
}
