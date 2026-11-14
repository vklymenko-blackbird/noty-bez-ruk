import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/preact';

const navigateMock = vi.fn();
vi.mock('../app/router', () => ({ navigate: (...args: unknown[]) => navigateMock(...args) }));

import OnboardingScreen from './OnboardingScreen';
import { settings } from '../settings';

function stubStandalone(standalone: boolean): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: standalone && query === '(display-mode: standalone)',
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() {
      return false;
    },
  }));
}

function renderScreen() {
  return render(<OnboardingScreen params={{}} />);
}

describe('OnboardingScreen (not installed)', () => {
  beforeEach(() => {
    stubStandalone(false);
    navigateMock.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the install step first, with no skip button', () => {
    renderScreen();
    expect(screen.getByTestId('onb-install-first')).toBeTruthy();
    expect(screen.queryByTestId('onb-skip')).toBeNull();
    expect(screen.queryByTestId('onb-next')).toBeNull();
  });

  it('continues from the install step to card 1', () => {
    renderScreen();
    fireEvent.click(screen.getByTestId('onb-continue-safari'));
    expect(screen.getByText('Ноти без рук')).toBeTruthy();
    expect(screen.getByTestId('onb-next')).toBeTruthy();
    expect(screen.getByTestId('onb-skip')).toBeTruthy();
  });

  it('moves through the cards with next and starts the app', () => {
    renderScreen();
    fireEvent.click(screen.getByTestId('onb-continue-safari'));
    fireEvent.click(screen.getByTestId('onb-next'));
    expect(screen.getByText('Поверніть голову — сторінка перегорнеться')).toBeTruthy();
    fireEvent.click(screen.getByTestId('onb-next'));
    expect(screen.getByText('Камера лише для жестів')).toBeTruthy();
    expect(screen.queryByTestId('onb-next')).toBeNull();
    expect(screen.getByTestId('onb-install')).toBeTruthy();
    expect(screen.getByText('На довгих заняттях тримайте iPad на зарядці.')).toBeTruthy();

    fireEvent.click(screen.getByTestId('onb-start'));
    expect(settings.get().onboardingDone).toBe(true);
    expect(navigateMock).toHaveBeenCalledWith('/', { replace: true });
  });

  it('skip sets onboardingDone and leaves the screen', () => {
    settings.set({ onboardingDone: false });
    renderScreen();
    fireEvent.click(screen.getByTestId('onb-continue-safari'));
    fireEvent.click(screen.getByTestId('onb-skip'));
    expect(settings.get().onboardingDone).toBe(true);
    expect(navigateMock).toHaveBeenCalledWith('/', { replace: true });
  });
});

describe('OnboardingScreen (installed)', () => {
  beforeEach(() => {
    stubStandalone(true);
    navigateMock.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('skips the install step and starts at card 1', () => {
    renderScreen();
    expect(screen.queryByTestId('onb-install-first')).toBeNull();
    expect(screen.getByTestId('onb-next')).toBeTruthy();
  });

  it('does not show the install reminder on card 3', () => {
    renderScreen();
    fireEvent.click(screen.getByTestId('onb-next'));
    fireEvent.click(screen.getByTestId('onb-next'));
    expect(screen.getByTestId('onb-start')).toBeTruthy();
    expect(screen.queryByTestId('onb-install')).toBeNull();
  });
});
