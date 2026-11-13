import type { ComponentChildren } from 'preact';
import { Icon, type IconName } from './Icon';

export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'md' | 'lg';
  icon?: IconName;
  full?: boolean;
  disabled?: boolean;
  onClick?: (e: MouseEvent) => void;
  children?: ComponentChildren;
  class?: string;
  'data-testid'?: string;
  type?: 'button' | 'submit';
}

export function Button({ variant = 'secondary', size = 'md', icon, full, disabled, onClick, children, class: cls, type = 'button', ...rest }: ButtonProps) {
  const c = ['ui-button', `ui-button--${variant}`, size === 'lg' ? 'ui-button--lg' : '', full ? 'ui-button--full' : '', cls ?? '']
    .filter(Boolean)
    .join(' ');
  return (
    <button type={type} class={c} disabled={disabled} onClick={onClick} data-testid={rest['data-testid']}>
      {icon ? <Icon name={icon} size={size === 'lg' ? 24 : 20} /> : null}
      {children}
    </button>
  );
}
