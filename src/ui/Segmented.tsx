export interface SegmentedProps {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  label: string;
  class?: string;
  'data-testid'?: string;
}

export function Segmented({ options, value, onChange, label, class: cls, ...rest }: SegmentedProps) {
  return (
    <div class={`ui-segmented${cls ? ` ${cls}` : ''}`} role="radiogroup" aria-label={label} data-testid={rest['data-testid']}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={o.value === value} class="ui-segmented__item"
          data-testid={rest['data-testid'] ? `${rest['data-testid']}-${o.value}` : undefined} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
