import { useEffect, useRef, useState } from 'preact/hooks';
import type { AnnotationToolbarProps, PenColor } from '../contracts';
import { t, type StringKey } from '../i18n';
import { Button, ConfirmSheet, IconButton, toast } from '../ui';
import './annot.css';

/** The dot colour comes from the CSS: .ui-chip__swatch[data-swatch] maps each name to a pen token. */
const PEN_SWATCHES: { color: PenColor; label: StringKey }[] = [
  { color: 'ink', label: 'annot.color.ink' },
  { color: 'burgundy', label: 'annot.color.burgundy' },
  { color: 'blue', label: 'annot.color.blue' },
];

const STAMP_DIGITS = [1, 2, 3, 4, 5] as const;

/** Bottom bar of the note mode: tools, undo, redo, clear, cancel and done. */
export default function AnnotationToolbar({ session, page, onDone, onCancel }: AnnotationToolbarProps) {
  const [, setTick] = useState(0);
  const [saving, setSaving] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => session.subscribe(() => setTick((n) => n + 1)), [session]);

  const tool = session.getTool();
  const canUndo = session.canUndo(page);
  const canRedo = session.canRedo(page);
  const penActive = (c: PenColor): boolean => tool.tool === 'pen' && tool.color === c;

  const cancel = () => {
    if (savingRef.current) return;
    session.revert();
    onCancel();
  };

  const done = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await session.commit();
    } catch {
      savingRef.current = false;
      setSaving(false);
      toast(t('annot.saveFailed'), { kind: 'error' });
      return;
    }
    savingRef.current = false;
    setSaving(false);
    toast(t('annot.saved'), { kind: 'ok' });
    onDone();
  };

  return (
    <>
      <div class="annot-toolbar" data-testid="annot-toolbar" data-nav-ignore data-saving={saving ? 'true' : 'false'}>
        <div class="annot-toolbar__row">
          <div class="annot-toolbar__group">
            <IconButton icon="close" label={t('annot.cancel')} onClick={cancel} disabled={saving} data-testid="annot-cancel" />
          </div>
          <span class="annot-toolbar__sep" aria-hidden="true" />
          <div class="annot-toolbar__group">
            {PEN_SWATCHES.map((s) => (
              <button
                key={s.color}
                type="button"
                class={penActive(s.color) ? 'ui-chip annot-swatch ui-chip--selected' : 'ui-chip annot-swatch'}
                aria-label={t(s.label)}
                aria-pressed={penActive(s.color)}
                disabled={saving}
                onClick={() => session.setTool({ tool: 'pen', color: s.color })}
                data-testid={`color-${s.color}`}
              >
                <span class="ui-chip__swatch" data-swatch={s.color} />
              </button>
            ))}
            <IconButton
              icon="highlighter"
              label={t('annot.highlighter')}
              active={tool.tool === 'highlighter'}
              disabled={saving}
              onClick={() => session.setTool({ tool: 'highlighter' })}
              data-testid="tool-highlighter"
            />
            <IconButton
              icon="eraser"
              label={t('annot.eraser')}
              active={tool.tool === 'eraser'}
              disabled={saving}
              onClick={() => session.setTool({ tool: 'eraser' })}
              data-testid="tool-eraser"
            />
          </div>
          <span class="annot-toolbar__sep" aria-hidden="true" />
          <div class="annot-toolbar__group">
            <IconButton icon="undo" label={t('annot.undo')} disabled={saving || !canUndo} onClick={() => session.undo(page)} data-testid="annot-undo" />
            <IconButton icon="redo" label={t('annot.redo')} disabled={saving || !canRedo} onClick={() => session.redo(page)} data-testid="annot-redo" />
            <IconButton icon="trash" label={t('annot.clear')} disabled={saving} onClick={() => setConfirmClear(true)} data-testid="annot-clear" />
          </div>
          <div class="annot-toolbar__group annot-toolbar__end">
            <Button variant="primary" icon="check" disabled={saving} onClick={done} data-testid="annot-done">
              <span aria-hidden="true">{t('annot.saveShort')}</span>
              <span class="sr-only">{t('annot.save')}</span>
            </Button>
          </div>
        </div>
        <div class="annot-toolbar__row annot-toolbar__row--stamps">
          <div class="annot-toolbar__group">
            {STAMP_DIGITS.map((d) => {
              const selected = tool.tool === 'stamp' && tool.stampDigit === d;
              return (
                <button
                  key={d}
                  type="button"
                  class={selected ? 'ui-chip annot-stamp ui-chip--selected' : 'ui-chip annot-stamp'}
                  aria-label={`${t('annot.stamp')} ${d}`}
                  aria-pressed={selected}
                  disabled={saving}
                  onClick={() => session.setTool({ tool: 'stamp', stampDigit: d })}
                  data-testid={`tool-stamp-${d}`}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <ConfirmSheet
        open={confirmClear}
        title={t('annot.clear')}
        body={t('annot.clear.confirm')}
        confirmLabel={t('annot.clear')}
        danger
        onConfirm={() => {
          session.clearPage(page);
          setConfirmClear(false);
        }}
        onCancel={() => setConfirmClear(false)}
      />
    </>
  );
}
