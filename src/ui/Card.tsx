import type { ComponentChildren } from 'preact';

export interface CardProps {
  children?: ComponentChildren;
  onClick?: () => void;
  class?: string;
  'data-testid'?: string;
}

export function Card({ children, onClick, class: cls, ...rest }: CardProps) {
  const c = ['ui-card', onClick ? 'ui-card--click' : '', cls ?? ''].filter(Boolean).join(' ');
  if (onClick) {
    return (
      <div class={c} role="button" tabIndex={0} onClick={onClick} data-testid={rest['data-testid']}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}>
        {children}
      </div>
    );
  }
  return <div class={c} data-testid={rest['data-testid']}>{children}</div>;
}
