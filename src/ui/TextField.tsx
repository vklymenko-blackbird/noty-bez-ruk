import { useEffect, useRef } from 'preact/hooks';
import { Icon, type IconName } from './Icon';

export interface TextFieldProps {
  label: string;
  value: string;
  onInput: (value: string) => void;
  placeholder?: string;
  type?: string;
  icon?: IconName;
  autofocus?: boolean;
  /** Shows the label above the field. Without it the label is only for screen readers. */
  showLabel?: boolean;
  onSubmit?: () => void;
  class?: string;
  'data-testid'?: string;
}

export function TextField({ label, value, onInput, placeholder, type = 'text', icon, autofocus, showLabel, onSubmit, class: cls, ...rest }: TextFieldProps) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autofocus) ref.current?.focus();
  }, [autofocus]);
  const input = (
    <input
      ref={ref}
      class="ui-field__input"
      type={type}
      value={value}
      placeholder={placeholder}
      aria-label={label}
      data-testid={rest['data-testid']}
      onInput={(e) => onInput((e.currentTarget as HTMLInputElement).value)}
      onKeyDown={(e) => { if (e.key === 'Enter' && onSubmit) onSubmit(); }}
    />
  );
  if (showLabel) {
    return (
      <label class={`ui-field-group${cls ? ` ${cls}` : ''}`}>
        <span class="ui-label">{label}</span>
        <span class="ui-field">
          {icon ? <Icon name={icon} /> : null}
          {input}
        </span>
      </label>
    );
  }
  return (
    <label class={`ui-field${cls ? ` ${cls}` : ''}`}>
      <span class="sr-only">{label}</span>
      {icon ? <Icon name={icon} /> : null}
      {input}
    </label>
  );
}
