import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, fireEvent, screen, cleanup, act } from '@testing-library/preact';
import { Sheet, Slider, Switch, ToastHost, toast, clearToasts } from './index';

afterEach(() => {
  cleanup();
  clearToasts();
});

describe('Sheet', () => {
  it('renders nothing when closed', () => {
    render(<Sheet open={false} onClose={() => {}} title="T">x</Sheet>);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('opens, focuses and closes on scrim tap and Escape', () => {
    const onClose = vi.fn();
    render(<Sheet open onClose={onClose} title="Заголовок">тіло</Sheet>);
    const dlg = screen.getByRole('dialog');
    expect(document.activeElement).toBe(dlg);
    // A click without a pointerdown on the scrim (the ghost click after a touch tap that opened it) is ignored, at any time.
    fireEvent.click(screen.getByTestId('sheet-scrim'));
    expect(onClose).not.toHaveBeenCalled();
    const now = performance.now();
    const spy = vi.spyOn(performance, 'now').mockReturnValue(now + 10_000);
    fireEvent.click(screen.getByTestId('sheet-scrim'));
    spy.mockRestore();
    expect(onClose).not.toHaveBeenCalled();
    // A real press on the scrim closes it.
    fireEvent.pointerDown(screen.getByTestId('sheet-scrim'));
    fireEvent.click(screen.getByTestId('sheet-scrim'));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
  it('does not close when the sheet body is tapped', () => {
    const onClose = vi.fn();
    render(<Sheet open onClose={onClose}>x</Sheet>);
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('toast', () => {
  it('shows a status message and runs the action', async () => {
    const onClick = vi.fn();
    render(<ToastHost />);
    act(() => {
      toast('Додано', { action: { label: 'Відмінити', onClick } });
    });
    expect(screen.getByRole('status').textContent).toContain('Додано');
    fireEvent.click(screen.getByText('Відмінити'));
    expect(onClick).toHaveBeenCalled();
    expect(screen.queryByRole('status')).toBeNull();
  });
  it('disappears after the duration', () => {
    vi.useFakeTimers();
    render(<ToastHost />);
    act(() => {
      toast('Хутко', { durationMs: 1000 });
    });
    expect(screen.queryByRole('status')).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(screen.queryByRole('status')).toBeNull();
    vi.useRealTimers();
  });
});

describe('Slider', () => {
  it('shows the formatted value and reports numbers', () => {
    const onInput = vi.fn();
    render(<Slider label="Кут" min={12} max={35} step={1} value={20} onInput={onInput} format={(v) => `${v}°`} data-testid="s" />);
    expect(screen.getByText('20°')).toBeTruthy();
    fireEvent.input(screen.getByTestId('s'), { target: { value: '25' } });
    expect(onInput).toHaveBeenCalledWith(25);
  });
});

describe('Switch', () => {
  it('toggles', () => {
    const onChange = vi.fn();
    render(<Switch label="Поля" checked={false} onChange={onChange} hint="підказка" data-testid="sw" />);
    expect(screen.getByText('підказка')).toBeTruthy();
    fireEvent.click(screen.getByTestId('sw'));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
