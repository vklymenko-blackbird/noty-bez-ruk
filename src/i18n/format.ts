import { t } from './index';

/** One decimal with a comma, always: «4,0». */
function oneDecimal(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1).replace('.', ',');
}

/** File and storage sizes in one style: КБ without decimals under 1 МБ, then «4,0 МБ», and «1,5 ГБ» from 1024 МБ up. */
export function sizeText(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return t('common.sizeGb', { size: oneDecimal(mb / 1024) });
  if (mb >= 1) return t('common.sizeMb', { size: oneDecimal(mb) });
  return t('common.sizeKb', { size: Math.max(1, Math.round(bytes / 1024)) });
}

/** The licence text for the screen. The data keeps the original value («Public domain»). */
export function licenseText(raw: string): string {
  const v = raw.trim();
  if (/^(public domain|pd)(\b|-)/i.test(v) || /^pd[-\s]/i.test(v)) return t('license.publicDomain');
  return v;
}
