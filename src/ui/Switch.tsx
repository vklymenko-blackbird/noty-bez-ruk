export interface SwitchProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: string;
  class?: string;
  'data-testid'?: string;
}

export function Switch({ label, checked, onChange, hint, class: cls, ...rest }: SwitchProps) {
  return (
    <label class={`ui-switch${cls ? ` ${cls}` : ''}`}>
      <span class="ui-switch__text">
        <span>{label}</span>
        {hint ? <span class="ui-switch__hint">{hint}</span> : null}
      </span>
      <input
        class="ui-switch__input"
        type="checkbox"
        role="switch"
        checked={checked}
        data-testid={rest['data-testid']}
        onChange={(e) => onChange((e.currentTarget as HTMLInputElement).checked)}
      />
      <span class="ui-switch__track" aria-hidden="true" />
    </label>
  );
}
