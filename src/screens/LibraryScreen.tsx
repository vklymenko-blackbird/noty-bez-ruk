import { useEffect, useRef, useState } from 'preact/hooks';
import type { LibrarySort, ScoreMeta, ScreenProps, StorageEstimate } from '../contracts';
import { TopBar, IconButton, Button, Icon, EmptyState, Segmented, Spinner, toast } from '../ui';
import { t, uk, type StringKey } from '../i18n';
import { storage } from '../storage';
import { useSettings, settings } from '../settings';
import { importFiles, sortScores } from '../library';
import { navigate } from '../app/router';
import Cover from '../library/Cover';
import './Library.css';

/** True when the app runs from the Home Screen (or standalone display mode). */
function isStandalone(): boolean {
  try {
    const nav = navigator as Navigator & { standalone?: boolean };
    if (nav.standalone === true) return true;
    return typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches;
  } catch {
    return false;
  }
}

/** The text for an import error code. Falls back to the generic text for unknown codes. */
function errorText(code: string, name: string): string {
  const key = `error.${code}`;
  const useKey = (key in uk ? key : 'error.generic') as StringKey;
  return t(useKey, { name });
}

/** The id of the score with the newest lastOpenedAt, or null when none was opened. */
function continueId(list: ScoreMeta[]): string | null {
  let best: ScoreMeta | null = null;
  for (const s of list) {
    if (s.lastOpenedAt > 0 && (best === null || s.lastOpenedAt > best.lastOpenedAt)) best = s;
  }
  return best ? best.id : null;
}

export default function LibraryScreen(_props: ScreenProps) {
  const current = useSettings();
  const [scores, setScores] = useState<ScoreMeta[]>([]);
  const [estimate, setEstimate] = useState<StorageEstimate | null>(null);
  const [importing, setImporting] = useState(false);
  const [installed] = useState<boolean>(() => isStandalone());
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    const load = () => {
      storage.listScores().then((list) => {
        if (alive) setScores(list);
      }, () => undefined);
    };
    load();
    storage.estimate().then((e) => {
      if (alive) setEstimate(e);
    }, () => undefined);
    const unsubscribe = storage.subscribe(load);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  const sorted = sortScores(scores, current.librarySort);
  const continueFor = continueId(scores);
  const showInstall = !installed;
  const volatile = estimate?.volatile === true;
  const notPersisted = scores.length > 0 && estimate !== null && estimate.persisted === false;

  const openPicker = () => fileInput.current?.click();

  const onFiles = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    input.value = '';
    if (files.length === 0) return;
    setImporting(true);
    try {
      const report = await importFiles(files);
      if (report.added.length === 1) {
        toast(t('library.imported.one', { title: report.added[0].title }), { kind: 'ok' });
      } else if (report.added.length > 1) {
        toast(t('library.imported.many', { count: report.added.length }), { kind: 'ok' });
      }
      for (const f of report.failed) {
        toast(errorText(f.code, f.fileName), { kind: 'error' });
      }
    } finally {
      setImporting(false);
    }
  };

  const setSort = (value: string) => {
    settings.set({ librarySort: value as LibrarySort });
  };

  const actions = (
    <>
      <IconButton icon="search" label={t('library.find')} onClick={() => navigate('/search')} data-testid="btn-search" />
      <IconButton icon="settings" label={t('library.settings')} onClick={() => navigate('/settings')} data-testid="btn-settings" />
    </>
  );

  const fileInputEl = (
    <input
      ref={fileInput}
      type="file"
      accept="application/pdf,.pdf"
      multiple
      hidden
      onChange={onFiles}
      data-testid="input-file"
    />
  );

  if (scores.length === 0) {
    return (
      <main class="screen" data-testid="screen-library">
        <div class="screen-inner library">
          <TopBar title={t('library.title')} serif actions={actions} />
          {showInstall ? <InstallBanner /> : null}
          {volatile ? <VolatileWarning /> : null}
          <EmptyState title={t('library.empty.title')} body={t('library.empty.body')} art="stave" data-testid="library-empty">
            <Button variant="primary" icon="search" onClick={() => navigate('/search')} data-testid="btn-find">
              {t('library.empty.find')}
            </Button>
            <Button variant="secondary" icon="file" onClick={openPicker} data-testid="btn-open-pdf">
              {t('library.openPdf')}
            </Button>
          </EmptyState>
          {importing ? <ImportingRow /> : null}
          {fileInputEl}
        </div>
      </main>
    );
  }

  return (
    <main class="screen" data-testid="screen-library">
      <div class="screen-inner library">
        <TopBar title={t('library.title')} serif actions={actions} />
        {showInstall ? <InstallBanner /> : null}
        {volatile ? <VolatileWarning /> : null}

        {scores.length > 1 ? (
          <Segmented
            class="library__sort"
            label={t('library.sort.label')}
            value={current.librarySort}
            onChange={setSort}
            options={[
              { value: 'recent', label: t('library.sort.recent') },
              { value: 'title', label: t('library.sort.title') },
              { value: 'added', label: t('library.sort.added') },
            ]}
            data-testid="library-sort"
          />
        ) : null}

        <ul class="library__grid" data-testid="library-grid">
          {sorted.map((s) => (
            <li key={s.id} class="library__item">
              <button
                type="button"
                class="library__card"
                data-testid="score-card"
                data-id={s.id}
                onClick={() => navigate('/score/' + s.id)}
              >
                <div class="library__cover">
                  <Cover class="cover--fluid" title={s.title} composer={s.composer} detail={s.detail} />
                  {s.id === continueFor ? (
                    <span class="library__ribbon" data-testid="continue-ribbon">
                      {t('library.continue')}
                    </span>
                  ) : null}
                </div>
                <span class="library__title">{s.title}</span>
                {s.composer ? <span class="library__composer">{s.composer}</span> : null}
                <span class="library__page">{t('common.pageOf', { page: s.lastPage, count: s.pageCount })}</span>
              </button>
            </li>
          ))}
        </ul>

        {notPersisted ? <p class="library__note">{t('library.notPersisted')}</p> : null}
        {importing ? <ImportingRow /> : null}

        <div class="library__actions">
          <Button variant="primary" size="lg" icon="search" full onClick={() => navigate('/search')} data-testid="btn-find">
            {t('library.find')}
          </Button>
          <Button variant="secondary" size="lg" icon="file" full onClick={openPicker} data-testid="btn-open-pdf">
            {t('library.openPdf')}
          </Button>
        </div>
        {fileInputEl}
      </div>
    </main>
  );
}

function InstallBanner() {
  return (
    <div class="library__banner" role="note" data-testid="library-install">
      <Icon name="share" size={20} />
      <span>{t('library.install.banner')}</span>
    </div>
  );
}

function VolatileWarning() {
  return (
    <div class="library__warning" role="alert" data-testid="library-volatile">
      <Icon name="alert" size={20} />
      <span>{t('library.volatile')}</span>
    </div>
  );
}

function ImportingRow() {
  return (
    <div class="library__importing" role="status">
      <Spinner size={20} />
      <span>{t('library.importing')}</span>
    </div>
  );
}
