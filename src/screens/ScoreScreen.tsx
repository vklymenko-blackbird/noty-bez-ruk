import { useEffect, useRef, useState } from 'preact/hooks';
import type { CropBox, PaperTheme, PdfDoc, ScorePatch, ScoreMeta, ScreenProps } from '../contracts';
import { AppError, FULL_PAGE } from '../contracts';
import { TopBar, IconButton, Button, Chip, Switch, TextField, Sheet, ConfirmSheet, Spinner, toast } from '../ui';
import Cover from '../library/Cover';
import { PAPER_THEMES, paperClass, getCropBox } from '../paper';
import { openPdf } from '../pdf';
import { storage } from '../storage';
import { useSettings } from '../settings';
import { t, uk, type StringKey } from '../i18n';
import { navigate } from '../app/router';
import './Score.css';

/** How many thumbnails the strip renders. */
const THUMB_LIMIT = 8;
const THUMB_WIDTH = 120;

/** True when the attribution link may be shown: https on commons.wikimedia.org only. */
export function isCommonsLink(url: string | null): url is string {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.hostname === 'commons.wikimedia.org';
  } catch {
    return false;
  }
}

/** The Ukrainian text for an error. Falls back to the generic message. */
function errorText(e: unknown): string {
  if (e instanceof AppError) {
    const key = `error.${e.code}`;
    if (key in uk) return t(key as StringKey);
  }
  return t('error.generic');
}

/** Puts a rendered page canvas into the thumbnail box. */
function ThumbCanvas({ canvas }: { canvas: HTMLCanvasElement }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    canvas.classList.add('score-thumb__img');
    el.replaceChildren(canvas);
  }, [canvas]);
  return <div ref={ref} class="score-thumb__canvas" />;
}

interface Thumb { page: number; canvas: HTMLCanvasElement }

export default function ScoreScreen({ params }: ScreenProps) {
  const id = params.id ?? '';
  const settings = useSettings();

  const [meta, setMeta] = useState<ScoreMeta | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [doc, setDoc] = useState<PdfDoc | null>(null);
  const [docFailed, setDocFailed] = useState(false);
  const [thumbs, setThumbs] = useState<Thumb[]>([]);

  const [menuOpen, setMenuOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftComposer, setDraftComposer] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Load the score. An unknown id goes back to the library.
  useEffect(() => {
    let alive = true;
    setLoaded(false);
    setMeta(null);
    storage
      .getScore(id)
      .then((found) => {
        if (!alive) return;
        if (!found) {
          toast(t('error.not-found'), { kind: 'error' });
          navigate('/', { replace: true });
          return;
        }
        setMeta(found);
        setLoaded(true);
      })
      .catch(() => {
        if (!alive) return;
        toast(t('error.generic'), { kind: 'error' });
        navigate('/', { replace: true });
      });
    return () => {
      alive = false;
    };
  }, [id]);

  // Open the PDF once per score. Destroyed on unmount or when the score changes.
  useEffect(() => {
    if (!loaded) return;
    let alive = true;
    let opened: PdfDoc | null = null;
    setDocFailed(false);
    setDoc(null);
    (async () => {
      const data = await storage.getScoreData(id);
      if (!data) throw new AppError('not-found');
      const d = await openPdf(data);
      if (!alive) {
        void d.destroy();
        return;
      }
      opened = d;
      setDoc(d);
    })().catch(() => {
      if (alive) setDocFailed(true);
    });
    return () => {
      alive = false;
      if (opened) void opened.destroy();
    };
  }, [loaded, id]);

  // Render the thumbnails one after another. Crop changes re-render them.
  const cropOn = meta ? (meta.crop ?? settings.autoCrop) : settings.autoCrop;
  useEffect(() => {
    if (!doc) return;
    let alive = true;
    setThumbs([]);
    const count = Math.min(doc.pageCount, THUMB_LIMIT);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    (async () => {
      for (let page = 1; page <= count; page += 1) {
        const crop: CropBox = cropOn ? await getCropBox(doc, page) : FULL_PAGE;
        const canvas = await doc.renderPage(page, { cssWidth: THUMB_WIDTH, dpr, crop });
        if (!alive) return;
        setThumbs((prev) => [...prev, { page, canvas }]);
      }
    })().catch(() => {
      if (alive) setDocFailed(true);
    });
    return () => {
      alive = false;
    };
  }, [doc, cropOn]);

  /** Saves a patch and keeps the new meta. Returns false on failure. */
  async function save(patch: ScorePatch): Promise<boolean> {
    try {
      const next = await storage.updateScore(id, patch);
      setMeta(next);
      return true;
    } catch (e) {
      toast(errorText(e), { kind: 'error' });
      return false;
    }
  }

  if (!loaded || !meta) {
    return (
      <main class="screen" data-testid="screen-score">
        <div class="screen-inner">
          <TopBar back="/" />
          <div class="score-loading">
            <Spinner />
          </div>
        </div>
      </main>
    );
  }

  const selectedPaper: PaperTheme = meta.paper ?? settings.paper;
  const lastPage = meta.lastPage;
  const pageCount = doc ? doc.pageCount : meta.pageCount;
  const source = meta.origin;
  const showLink = isCommonsLink(source.pageUrl);
  const sourceLine = source.license
    ? `${t('score.source', { source: source.sourceName })} · ${source.license}`
    : t('score.source', { source: source.sourceName });

  return (
    <main class="screen" data-testid="screen-score">
      <div class="screen-inner">
        <TopBar
          back="/"
          actions={
            <IconButton icon="more" label={t('common.more')} onClick={() => setMenuOpen(true)} data-testid="btn-more" />
          }
        />

        <section class="score-hero">
          <Cover title={meta.title} composer={meta.composer} detail={meta.detail || undefined} size="lg" />
          <div class="score-hero__info">
            <h2 class="score-title" data-testid="score-title">{meta.title}</h2>
            <p class="score-composer">{meta.composer || t('common.unknownComposer')}</p>
            {meta.detail ? <p class="score-detail">{meta.detail}</p> : null}
            <p class="score-meta">{t('common.pages', { count: meta.pageCount })}</p>
            <p class="score-source">
              {sourceLine}
              {showLink ? (
                <>
                  {' · '}
                  <a href={source.pageUrl ?? undefined} target="_blank" rel="noopener noreferrer" class="score-link">
                    {t('score.openSource')}
                  </a>
                </>
              ) : null}
            </p>
          </div>
        </section>

        <section class="score-section">
          {lastPage > 1 ? (
            <>
              <Button variant="primary" size="lg" full icon="play" data-testid="btn-play" onClick={() => navigate(`/play/${id}`)}>
                {t('score.continueFrom', { page: lastPage })}
              </Button>
              <Button
                variant="ghost"
                full
                data-testid="btn-from-start"
                onClick={async () => {
                  if (await save({ lastPage: 1 })) navigate(`/play/${id}`);
                }}
              >
                {t('score.fromStart')}
              </Button>
            </>
          ) : (
            <Button variant="primary" size="lg" full icon="play" data-testid="btn-play" onClick={() => navigate(`/play/${id}`)}>
              {t('score.play')}
            </Button>
          )}
        </section>

        <section class="score-section">
          <p class="ui-label">{t('score.paper')}</p>
          <div class="score-chips">
            {PAPER_THEMES.map((theme) => (
              <Chip
                key={theme}
                selected={selectedPaper === theme}
                swatch={theme}
                onClick={() => void save({ paper: theme })}
                data-testid={`paper-chip-${theme}`}
              >
                {t(`paper.${theme}` as StringKey)}
              </Chip>
            ))}
          </div>
        </section>

        <section class="score-section">
          <Switch
            label={t('score.crop')}
            hint={t('score.crop.hint')}
            checked={cropOn}
            onChange={(on) => void save({ crop: on })}
            data-testid="switch-crop"
          />
        </section>

        <section class="score-section">
          <p class="ui-label">{t('score.pagesTitle')}</p>
          {docFailed ? (
            <p class="score-error">{t('error.pdf-open-failed', { name: meta.title })}</p>
          ) : (
            <>
              <div class="score-strip" data-testid="thumb-strip">
                {thumbs.map(({ page, canvas }) => (
                  <button
                    key={page}
                    type="button"
                    class="score-thumb"
                    data-testid="thumb"
                    data-page={page}
                    aria-label={t('common.pageOf', { page, count: pageCount })}
                    onClick={async () => {
                      if (await save({ lastPage: page })) navigate(`/play/${id}`);
                    }}
                  >
                    <div class={`score-thumb__page ${paperClass(selectedPaper)}`}>
                      <ThumbCanvas canvas={canvas} />
                    </div>
                  </button>
                ))}
              </div>
              {doc && doc.pageCount > THUMB_LIMIT ? (
                <p class="score-meta">{t('score.morePages', { count: doc.pageCount - THUMB_LIMIT })}</p>
              ) : null}
            </>
          )}
        </section>

        <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title={meta.title} data-testid="score-menu">
          <div class="score-menu">
            <Button
              full
              data-testid="btn-rename"
              onClick={() => {
                setMenuOpen(false);
                setDraftTitle(meta.title);
                setDraftComposer(meta.composer);
                setRenameOpen(true);
              }}
            >
              {t('score.rename')}
            </Button>
            <Button
              full
              variant="danger"
              data-testid="btn-delete"
              onClick={() => {
                setMenuOpen(false);
                setDeleteOpen(true);
              }}
            >
              {t('score.delete')}
            </Button>
          </div>
        </Sheet>

        <Sheet open={renameOpen} onClose={() => setRenameOpen(false)} title={t('score.rename')} data-testid="rename-sheet">
          <div class="score-menu">
            <TextField
              label={t('score.rename.title')}
              value={draftTitle}
              onInput={setDraftTitle}
              autofocus
              showLabel
              data-testid="rename-title"
            />
            <TextField
              label={t('score.rename.composer')}
              value={draftComposer}
              onInput={setDraftComposer}
              showLabel
              data-testid="rename-composer"
            />
            <div class="score-actions">
              <Button onClick={() => setRenameOpen(false)} data-testid="rename-cancel">{t('common.cancel')}</Button>
              <Button
                variant="primary"
                disabled={!draftTitle.trim()}
                data-testid="rename-save"
                onClick={async () => {
                  const title = draftTitle.trim();
                  if (!title) return;
                  if (await save({ title, composer: draftComposer.trim() })) setRenameOpen(false);
                }}
              >
                {t('common.save')}
              </Button>
            </div>
          </div>
        </Sheet>

        <ConfirmSheet
          open={deleteOpen}
          title={t('score.delete.confirm')}
          body={t('score.delete.body', { title: meta.title })}
          confirmLabel={t('common.delete')}
          danger
          onCancel={() => setDeleteOpen(false)}
          onConfirm={async () => {
            try {
              await storage.deleteScore(id);
            } catch (e) {
              toast(errorText(e), { kind: 'error' });
              return;
            }
            setDeleteOpen(false);
            toast(t('score.deleted'), { kind: 'ok' });
            navigate('/', { replace: true });
          }}
        />
      </div>
    </main>
  );
}
