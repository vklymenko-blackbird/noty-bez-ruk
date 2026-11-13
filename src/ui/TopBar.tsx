import type { ComponentChildren } from 'preact';
import { IconButton } from './IconButton';
import { t } from '../i18n';
import { back } from '../app/router';

export interface TopBarProps {
  title?: string;
  back?: string;
  actions?: ComponentChildren;
  serif?: boolean;
  class?: string;
  'data-testid'?: string;
}

export function TopBar({ title, back: backTo, actions, serif, class: cls, ...rest }: TopBarProps) {
  return (
    <header class={`ui-topbar${cls ? ` ${cls}` : ''}`} data-testid={rest['data-testid'] ?? 'topbar'}>
      {backTo ? <IconButton icon="back" label={t('common.back')} onClick={() => back(backTo)} data-testid="topbar-back" /> : null}
      <h1 class={`ui-topbar__title${serif ? ' ui-topbar__title--serif' : ''}`}>{title}</h1>
      {actions ? <div class="ui-topbar__actions">{actions}</div> : null}
    </header>
  );
}
