import { describe, expect, it, beforeEach } from 'vitest';
import { render, fireEvent, screen, cleanup, act } from '@testing-library/preact';
import SettingsScreen, { keyLabel, sizeText } from './SettingsScreen';
import { settings } from '../settings';
import { DEFAULT_SETTINGS } from '../contracts';
import { t } from '../i18n';

function renderScreen() {
  return render(<SettingsScreen params={{}} />);
}

beforeEach(() => {
  cleanup();
  settings.reset();
});

describe('SettingsScreen', () => {
  it('keeps the screen root and test id', () => {
    const { container } = renderScreen();
    expect(container.querySelector('[data-testid="screen-settings"]')).not.toBeNull();
  });

  it('the gesture choice writes the setting and changes the hint', () => {
    renderScreen();
    expect(screen.getByText(t('settings.gesture.hint.head'))).toBeTruthy();
    fireEvent.click(screen.getByTestId('set-gesture-mouth'));
    expect(settings.get().gesture).toBe('mouth');
    expect(screen.getByText(t('settings.gesture.hint.mouth'))).toBeTruthy();
  });

  it('gesture off hides the sensitivity group', () => {
    renderScreen();
    expect(screen.queryByTestId('set-group-sensitivity')).not.toBeNull();
    fireEvent.click(screen.getByTestId('set-gesture-off'));
    expect(screen.queryByTestId('set-group-sensitivity')).toBeNull();
  });

  it('sliders write values inside the limits', () => {
    renderScreen();
    const angle = screen.getByTestId('set-angle') as HTMLInputElement;
    fireEvent.input(angle, { target: { value: '99' } });
    expect(settings.get().yawThresholdDeg).toBe(35);
    const hold = screen.getByTestId('set-hold') as HTMLInputElement;
    fireEvent.input(hold, { target: { value: '700' } });
    expect(settings.get().holdMs).toBe(700);
  });

  it('learn mode adds a key to next and removes it from prev', () => {
    renderScreen();
    fireEvent.click(screen.getByTestId('set-learn-next'));
    expect(screen.getByTestId('set-learn-next').textContent).toBe(t('settings.pedal.press'));
    fireEvent.keyDown(window, { key: 'a' });
    expect(settings.get().keysNext).toContain('a');
    expect(screen.getByTestId('set-learn-next').textContent).toBe(t('settings.pedal.learn'));

    fireEvent.click(screen.getByTestId('set-learn-prev'));
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(settings.get().keysPrev).toContain('ArrowRight');
    expect(settings.get().keysNext).not.toContain('ArrowRight');
  });

  it('shows a muted note when a direction has no keys, and the last next key is not kept (F5)', () => {
    settings.set({ keysNext: ['q'], keysPrev: ['w'] });
    renderScreen();
    fireEvent.click(screen.getByTestId('set-learn-prev'));
    fireEvent.keyDown(window, { key: 'q' });
    expect(settings.get().keysNext).toEqual([]);
    expect(settings.get().keysPrev).toEqual(['w', 'q']);
    expect(screen.getByTestId('set-keys-next-none').textContent).toBe('Немає клавіш');
    expect(screen.queryByTestId('set-keys-prev-none')).toBeNull();
  });

  it('Escape cancels learn mode without changing keys', () => {
    renderScreen();
    fireEvent.click(screen.getByTestId('set-learn-next'));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(settings.get().keysNext).toEqual(DEFAULT_SETTINGS.keysNext);
    expect(screen.getByTestId('set-learn-next').textContent).toBe(t('settings.pedal.learn'));
  });

  it('a chip tap removes that key', () => {
    renderScreen();
    const before = settings.get().keysPrev.length;
    const chips = screen.getAllByTestId('set-keys-prev-chip');
    expect(chips.length).toBe(before);
    act(() => {
      fireEvent.click(chips[0]);
    });
    expect(settings.get().keysPrev).not.toContain(DEFAULT_SETTINGS.keysPrev[0]);
  });

  it('the space key is shown with its label', () => {
    renderScreen();
    const labels = screen.getAllByTestId('set-keys-next-chip').map((c) => c.textContent);
    expect(labels).toContain(t('settings.pedal.space'));
  });

  it('reset restores defaults and keeps onboarding done', () => {
    renderScreen();
    fireEvent.click(screen.getByTestId('set-gesture-off'));
    fireEvent.click(screen.getByTestId('set-reset'));
    fireEvent.click(screen.getByTestId('confirm-ok'));
    const s = settings.get();
    expect(s.gesture).toBe(DEFAULT_SETTINGS.gesture);
    expect(s.keysNext).toEqual(DEFAULT_SETTINGS.keysNext);
    expect(s.onboardingDone).toBe(true);
  });

  it('shows friendly names for the default pedal keys', () => {
    const { container } = renderScreen();
    const chips = Array.from(container.querySelectorAll('.set-pedal-row__chips .ui-chip')).map((c) => c.textContent);
    expect(chips.join('|')).not.toMatch(/Arrow/);
    expect(chips).toContain('→ Стрілка вправо');
    expect(chips).toContain('Page Down');
    expect(chips).toContain('Пробіл');
  });

  it('keyLabel names arrows, shows letters in upper case and keeps unknown keys', () => {
    expect(keyLabel('ArrowLeft')).toBe('← Стрілка вліво');
    expect(keyLabel('ArrowUp')).toBe('↑ Стрілка вгору');
    expect(keyLabel('ArrowDown')).toBe('↓ Стрілка вниз');
    expect(keyLabel(' ')).toBe('Пробіл');
    expect(keyLabel('Backspace')).toBe('Backspace');
    expect(keyLabel('b')).toBe('B');
    expect(keyLabel('F5')).toBe('F5');
  });

  it('shows storage sizes in ГБ from 1024 МБ up', () => {
    const MB = 1024 * 1024;
    expect(sizeText(0.1 * MB)).toBe('102 КБ');
    expect(sizeText(4 * MB)).toBe('4,0 МБ');
    expect(sizeText(1023 * MB)).toBe('1023,0 МБ');
    expect(sizeText(5120.1 * MB)).toBe('5,0 ГБ');
    expect(sizeText(1536 * MB)).toBe('1,5 ГБ');
  });
});
