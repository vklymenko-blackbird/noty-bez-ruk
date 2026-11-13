import type { ControlsSheetProps } from '../contracts';
import { Button, Sheet } from '../ui';
import { t } from '../i18n';
import './controls.css';

/** STUB: replaced by package play-controls. Only «Вийти». */
export default function ControlsSheet(props: ControlsSheetProps) {
  return (
    <Sheet open={props.open} onClose={props.onClose} title={props.title} data-testid="controls-sheet">
      <Button variant="secondary" full onClick={props.onExit} data-testid="controls-exit">
        {t('controls.exit')}
      </Button>
    </Sheet>
  );
}
