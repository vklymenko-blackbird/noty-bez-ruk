export function Spinner({ size = 24 }: { size?: number }) {
  return <span class="ui-spinner" role="progressbar" aria-label="…" style={{ width: `${size}px`, height: `${size}px` }} />;
}
