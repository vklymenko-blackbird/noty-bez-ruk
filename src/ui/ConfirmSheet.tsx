import { Button } from './Button';
import { Sheet } from './Sheet';
import { t } from '../i18n';

export interface ConfirmSheetProps {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  'data-testid'?: string;
}

export function ConfirmSheet({ open, title, body, confirmLabel, danger, onConfirm, onCancel, ...rest }: ConfirmSheetProps) {
  return (
    <Sheet open={open} onClose={onCancel} title={title} data-testid={rest['data-testid'] ?? 'confirm-sheet'}>
      {body ? <p class="ui-sheet__body">{body}</p> : null}
      <div class="ui-sheet__actions">
        <Button onClick={onCancel} data-testid="confirm-cancel">{t('common.cancel')}</Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} data-testid="confirm-ok">{confirmLabel}</Button>
      </div>
    </Sheet>
  );
}
