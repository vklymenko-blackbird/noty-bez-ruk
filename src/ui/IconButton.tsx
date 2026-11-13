import { Icon, type IconName } from './Icon';

export interface IconButtonProps {
  icon: IconName;
  label: string;
  onClick?: (e: MouseEvent) => void;
  active?: boolean;
  disabled?: boolean;
  class?: string;
  'data-testid'?: string;
}

export function IconButton({ icon, label, onClick, active, disabled, class: cls, ...rest }: IconButtonProps) {
  const c = ['ui-icon-button', active ? 'ui-icon-button--active' : '', cls ?? ''].filter(Boolean).join(' ');
  return (
    <button type="button" class={c} aria-label={label} title={label} onClick={onClick} disabled={disabled} data-testid={rest['data-testid']}>
      <Icon name={icon} />
    </button>
  );
}
