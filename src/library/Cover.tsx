import type { CoverProps } from '../contracts';
import './cover.css';

/** STUB: replaced by package import-covers. Renders the title in a box. */
export default function Cover({ title, size = 'md' }: CoverProps) {
  return <div class={`cover-stub cover-stub--${size}`} data-testid="cover">{title}</div>;
}
