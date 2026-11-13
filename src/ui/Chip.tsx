import type { ComponentChildren } from 'preact';

export interface ChipProps {
  selected?: boolean;
  onClick?: () => void;
  children?: ComponentChildren;
  swatch?: string;
  class?: string;
  'data-testid'?: string;
}

export function Chip({ selected, onClick, children, swatch, class: cls, ...rest }: ChipProps) {
  const c = ['ui-chip', selected ? 'ui-chip--selected' : '', cls ?? ''].filter(Boolean).join(' ');
  return (
    <button type="button" class={c} aria-pressed={!!selected} onClick={onClick} data-testid={rest['data-testid']}>
      {swatch ? <span class="ui-chip__swatch" style={{ background: swatch }} /> : null}
      {children}
    </button>
  );
}
