let seq = 0;

export interface SliderProps {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onInput: (value: number) => void;
  format?: (value: number) => string;
  class?: string;
  'data-testid'?: string;
}

export function Slider({ label, min, max, step, value, onInput, format, class: cls, ...rest }: SliderProps) {
  const id = `ui-slider-${++seq}`;
  return (
    <div class={`ui-slider${cls ? ` ${cls}` : ''}`}>
      <div class="ui-slider__head">
        <label for={id}>{label}</label>
        <span class="ui-slider__value" data-testid={rest['data-testid'] ? `${rest['data-testid']}-value` : undefined}>
          {format ? format(value) : String(value)}
        </span>
      </div>
      <input
        id={id}
        class="ui-slider__input"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        data-testid={rest['data-testid']}
        onInput={(e) => onInput(Number((e.currentTarget as HTMLInputElement).value))}
      />
    </div>
  );
}
