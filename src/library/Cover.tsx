import type { CoverProps } from '../contracts';
import { Icon } from '../ui/Icon';
import './cover.css';

/** The six cover tints of SPEC 1.4. The CSS classes cover--tint-0 … cover--tint-5 set the colours. */
const TINT_COUNT = 6;

/** Picks a stable tint for a composer name: the sum of the char codes, mod 6. */
export function tintIndex(composer: string): number {
  let sum = 0;
  for (let i = 0; i < composer.length; i += 1) sum += composer.charCodeAt(i);
  return sum % TINT_COUNT;
}

/** The last word of the composer name, or '' when there is no name. */
function surnameOf(composer: string): string {
  const words = composer.trim().split(/\s+/).filter(Boolean);
  return words.length > 0 ? words[words.length - 1] : '';
}

const ICON_SIZE: Record<NonNullable<CoverProps['size']>, number> = { sm: 20, md: 24, lg: 32 };

/** A generated cover. No image, no network. Every visible part is a plain text node. */
export default function Cover({ title, composer, detail, size = 'md', class: extraClass }: CoverProps) {
  const surname = surnameOf(composer);
  const label = composer ? `${title}, ${composer}` : title;
  const classes = [
    'cover',
    `cover--${size}`,
    `cover--tint-${tintIndex(composer)}`,
    extraClass ?? '',
  ].filter(Boolean).join(' ');

  return (
    <div class={classes} data-testid="cover" role="img" aria-label={label}>
      <div class="cover__stripe" aria-hidden="true" />
      <div class="cover__frame" aria-hidden="true" />
      <div class="cover__body" aria-hidden="true">
        <div class="cover__head">
          {surname ? <span class="ui-label cover__surname">{surname}</span> : <Icon name="music" size={ICON_SIZE[size]} />}
        </div>
        <div class="cover__title">{title}</div>
        <div class="cover__foot">{detail ?? ''}</div>
      </div>
    </div>
  );
}
