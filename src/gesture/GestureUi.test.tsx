import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/preact';
import type { GestureSnapshot, GestureState, PoseStatus } from '../contracts';
import CalibrationOverlay from './CalibrationOverlay';
import GestureHud from './GestureHud';

function state(over: Partial<GestureState> = {}): GestureState {
  return {
    phase: 'neutral',
    dir: null,
    armProgress: 0,
    cooldownProgress: 0,
    calibrationProgress: 0,
    facePresent: true,
    relYawDeg: 0,
    neutralYawDeg: 4,
    paused: false,
    ...over,
  };
}

function snap(over: Partial<GestureState> = {}, status: PoseStatus = 'running'): GestureSnapshot {
  return { status, state: state(over) };
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('CalibrationOverlay', () => {
  it('is visible while calibrating and shows the no-face text', () => {
    render(<CalibrationOverlay snapshot={snap({ phase: 'calibrating', facePresent: false })} stream={null} onSkip={() => {}} />);
    expect(screen.getByTestId('calib-overlay')).toBeTruthy();
    expect(screen.getByText('Не бачу обличчя. Сядьте перед iPad.')).toBeTruthy();
  });

  it('shows the look text when the face is present', () => {
    render(<CalibrationOverlay snapshot={snap({ phase: 'calibrating', facePresent: true })} stream={null} onSkip={() => {}} />);
    expect(screen.getByText('Подивіться прямо на ноти')).toBeTruthy();
  });

  it('renders nothing when the status is denied', () => {
    render(<CalibrationOverlay snapshot={snap({ phase: 'calibrating' }, 'denied')} stream={null} onSkip={() => {}} />);
    expect(screen.queryByTestId('calib-overlay')).toBeNull();
  });

  it('shows the starting text with a spinner while loading', () => {
    render(<CalibrationOverlay snapshot={snap({ phase: 'idle' }, 'loading')} stream={null} onSkip={() => {}} />);
    expect(screen.getByText('Вмикаємо камеру…')).toBeTruthy();
    expect(screen.getByTestId('calib-skip')).toBeTruthy();
  });

  it('calls onSkip from the skip button', () => {
    const onSkip = vi.fn();
    render(<CalibrationOverlay snapshot={snap({ phase: 'calibrating' })} stream={null} onSkip={onSkip} />);
    fireEvent.click(screen.getByTestId('calib-skip'));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('keeps the done text for 700 ms after calibration, then removes the overlay', () => {
    vi.useFakeTimers();
    const { rerender } = render(<CalibrationOverlay snapshot={snap({ phase: 'calibrating' })} stream={null} onSkip={() => {}} />);
    rerender(<CalibrationOverlay snapshot={snap({ phase: 'neutral' })} stream={null} onSkip={() => {}} />);
    expect(screen.getByText('Готово')).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(699);
    });
    expect(screen.getByTestId('calib-overlay')).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    act(() => {});
    expect(screen.getByTestId('calib-overlay').className).toContain('calib--out');
    act(() => {
      vi.advanceTimersByTime(160);
    });
    act(() => {});
    expect(screen.queryByTestId('calib-overlay')).toBeNull();
  });
});

describe('GestureHud', () => {
  it('renders nothing when the gesture is off', () => {
    render(<GestureHud snapshot={snap({ phase: 'neutral' })} gesture="off" />);
    expect(screen.queryByTestId('hud-dot')).toBeNull();
  });

  it('sets data-state for paused, lost, arming and seen', () => {
    const cases: [GestureSnapshot, string][] = [
      [snap({ phase: 'neutral' }, 'loading'), 'paused'],
      [snap({ phase: 'neutral', facePresent: false }), 'lost'],
      [snap({ phase: 'arming', armProgress: 0.5 }), 'arming'],
      [snap({ phase: 'neutral' }), 'seen'],
    ];
    for (const [s, expected] of cases) {
      const { unmount } = render(<GestureHud snapshot={s} gesture="head" />);
      expect(screen.getByTestId('hud-dot').getAttribute('data-state')).toBe(expected);
      unmount();
    }
  });

  it('shows the cooldown line only in the cooldown phase', () => {
    const { unmount } = render(<GestureHud snapshot={snap({ phase: 'cooldown', cooldownProgress: 0.25 })} gesture="head" />);
    const line = screen.getByTestId('hud-cooldown');
    expect(line.getAttribute('style')).toContain('75%');
    unmount();
    render(<GestureHud snapshot={snap({ phase: 'neutral' })} gesture="head" />);
    expect(screen.queryByTestId('hud-cooldown')).toBeNull();
  });
});
