import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, fireEvent, screen, cleanup } from '@testing-library/preact';
import type { ControlsSheetProps, GestureKind, PoseStatus } from '../contracts';
import ControlsSheet from './ControlsSheet';

afterEach(() => {
  cleanup();
});

function makeProps(over: Partial<ControlsSheetProps> = {}): ControlsSheetProps {
  return {
    open: true,
    onClose: vi.fn(),
    title: 'Тест',
    page: 2,
    pageCount: 5,
    onGoToPage: vi.fn(),
    halfPage: false,
    onHalfPage: vi.fn(),
    paper: 'ivory',
    onPaper: vi.fn(),
    crop: false,
    onCrop: vi.fn(),
    gesture: 'head',
    cameraStatus: 'running' as PoseStatus,
    yawThresholdDeg: 20,
    onYawThreshold: vi.fn(),
    flip: false,
    onFlip: vi.fn(),
    onRecalibrate: vi.fn(),
    onAnnotate: vi.fn(),
    onExit: vi.fn(),
    ...over,
  };
}

function renderWith(gesture: GestureKind, over: Partial<ControlsSheetProps> = {}) {
  const props = makeProps({ gesture, ...over });
  render(<ControlsSheet {...props} />);
  return props;
}

describe('ControlsSheet callbacks', () => {
  it('sends the page from the slider', () => {
    const p = renderWith('off');
    fireEvent.input(screen.getByTestId('ctl-page'), { target: { value: '4' } });
    expect(p.onGoToPage).toHaveBeenCalledWith(4);
  });

  it('sends the half-page switch value', () => {
    const p = renderWith('off');
    fireEvent.click(screen.getByTestId('ctl-half'));
    expect(p.onHalfPage).toHaveBeenCalledWith(true);
  });

  it('sends the chosen paper theme', () => {
    const p = renderWith('off');
    fireEvent.click(screen.getByTestId('ctl-paper-sepia'));
    expect(p.onPaper).toHaveBeenCalledWith('sepia');
  });

  it('marks the current paper chip as selected', () => {
    renderWith('off', { paper: 'night' });
    expect(screen.getByTestId('ctl-paper-night').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('ctl-paper-ivory').getAttribute('aria-pressed')).toBe('false');
  });

  it('sends the crop switch value', () => {
    const p = renderWith('off');
    fireEvent.click(screen.getByTestId('ctl-crop'));
    expect(p.onCrop).toHaveBeenCalledWith(true);
  });

  it('sends the angle from the angle slider', () => {
    const p = renderWith('head');
    fireEvent.input(screen.getByTestId('ctl-angle'), { target: { value: '28' } });
    expect(p.onYawThreshold).toHaveBeenCalledWith(28);
  });

  it('sends the flip switch value', () => {
    const p = renderWith('head');
    fireEvent.click(screen.getByTestId('ctl-flip'));
    expect(p.onFlip).toHaveBeenCalledWith(true);
  });

  it('recalibrates, then closes the sheet', () => {
    const p = renderWith('head');
    fireEvent.click(screen.getByTestId('ctl-recalibrate'));
    expect(p.onRecalibrate).toHaveBeenCalledTimes(1);
    expect(p.onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onAnnotate and onExit', () => {
    const p = renderWith('off');
    fireEvent.click(screen.getByTestId('ctl-annotate'));
    fireEvent.click(screen.getByTestId('ctl-exit'));
    expect(p.onAnnotate).toHaveBeenCalledTimes(1);
    expect(p.onExit).toHaveBeenCalledTimes(1);
  });
});

describe('ControlsSheet visibility', () => {
  it('gesture off hides every camera row', () => {
    renderWith('off');
    expect(screen.queryByTestId('ctl-camera-status')).toBeNull();
    expect(screen.queryByTestId('ctl-angle')).toBeNull();
    expect(screen.queryByTestId('ctl-recalibrate')).toBeNull();
    expect(screen.queryByTestId('ctl-flip')).toBeNull();
  });

  it('gesture mouth hides the angle slider and recalibrate, keeps flip', () => {
    renderWith('mouth');
    expect(screen.getByTestId('ctl-camera-status')).toBeTruthy();
    expect(screen.queryByTestId('ctl-angle')).toBeNull();
    expect(screen.queryByTestId('ctl-recalibrate')).toBeNull();
    expect(screen.getByTestId('ctl-flip')).toBeTruthy();
  });

  it('gesture head shows the angle slider and recalibrate', () => {
    renderWith('head');
    expect(screen.getByTestId('ctl-angle')).toBeTruthy();
    expect(screen.getByTestId('ctl-recalibrate')).toBeTruthy();
  });

  it('recalibrate is disabled when the camera is not running', () => {
    renderWith('head', { cameraStatus: 'denied' });
    const btn = screen.getByTestId('ctl-recalibrate') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('recalibrate is enabled when the camera is running', () => {
    renderWith('head', { cameraStatus: 'running' });
    const btn = screen.getByTestId('ctl-recalibrate') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it('a single page hides the page slider', () => {
    renderWith('off', { pageCount: 1, page: 1 });
    expect(screen.queryByTestId('ctl-page')).toBeNull();
  });

  it('several pages show the page slider', () => {
    renderWith('off', { pageCount: 3 });
    expect(screen.getByTestId('ctl-page')).toBeTruthy();
  });
});
