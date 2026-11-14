import type { ComponentChildren } from 'preact';

export interface ProgressRingProps {
  value: number;
  size?: number;
  children?: ComponentChildren;
}

export function ProgressRing({ value, size = 64, children }: ProgressRingProps) {
  const v = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  const stroke = Math.max(2, Math.round(size / 24));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span class="ui-ring" style={{ width: `${size}px`, height: `${size}px` }} role="progressbar" aria-valuemin={0} aria-valuemax={1} aria-valuenow={v}>
      <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle class="ui-ring__track" cx={size / 2} cy={size / 2} r={r} stroke-width={stroke} />
        <circle class="ui-ring__bar" cx={size / 2} cy={size / 2} r={r} stroke-width={stroke} stroke-dasharray={c} stroke-dashoffset={c * (1 - v)} />
      </svg>
      <span class="ui-ring__content">{children}</span>
    </span>
  );
}
