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
  onSubmit?: () => void;
  class?: string;
  'data-testid'?: string;
}

export function TextField({ label, value, onInput, placeholder, type = 'text', icon, autofocus, onSubmit, class: cls, ...rest }: TextFieldProps) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autofocus) ref.current?.focus();
  }, [autofocus]);
  return (
    <label class={`ui-field${cls ? ` ${cls}` : ''}`}>
      <span class="sr-only">{label}</span>
      {icon ? <Icon name={icon} /> : null}
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
    </label>
  );
}
