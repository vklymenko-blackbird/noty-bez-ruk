import type { ComponentChildren } from 'preact';

export interface EmptyStateProps {
  title: string;
  body?: string;
  children?: ComponentChildren;
  art?: 'stave';
  'data-testid'?: string;
}

function StaveArt() {
  return (
    <svg class="ui-empty__art" viewBox="0 0 200 90" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">
      {[20, 32, 44, 56, 68].map((y) => <line key={y} x1="6" y1={y} x2="194" y2={y} />)}
      <line class="gold" x1="6" y1="20" x2="6" y2="68" />
      <line x1="194" y1="20" x2="194" y2="68" stroke-width="3" />
      <ellipse cx="70" cy="56" rx="7" ry="5" transform="rotate(-20 70 56)" fill="currentColor" />
      <line x1="76" y1="54" x2="76" y2="24" />
      <ellipse cx="116" cy="44" rx="7" ry="5" transform="rotate(-20 116 44)" fill="currentColor" />
      <line x1="122" y1="42" x2="122" y2="12" />
      <ellipse cx="158" cy="32" rx="7" ry="5" transform="rotate(-20 158 32)" fill="currentColor" />
      <line x1="152" y1="34" x2="152" y2="64" />
    </svg>
  );
}

export function EmptyState({ title, body, children, art, ...rest }: EmptyStateProps) {
  return (
    <div class="ui-empty" data-testid={rest['data-testid'] ?? 'empty-state'}>
      {art === 'stave' ? <StaveArt /> : null}
      <h2 class="ui-empty__title">{title}</h2>
      {body ? <p class="ui-empty__body">{body}</p> : null}
      {children ? <div class="ui-empty__actions">{children}</div> : null}
    </div>
  );
}
