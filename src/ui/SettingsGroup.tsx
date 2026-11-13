import type { ComponentChildren } from 'preact';
import { Card } from './Card';

export interface SettingsGroupProps {
  title: string;
  children?: ComponentChildren;
  'data-testid'?: string;
}

export function SettingsGroup({ title, children, ...rest }: SettingsGroupProps) {
  return (
    <section class="ui-group" data-testid={rest['data-testid']}>
      <h2 class="ui-label ui-group__title">{title}</h2>
      <Card>{children}</Card>
    </section>
  );
}
