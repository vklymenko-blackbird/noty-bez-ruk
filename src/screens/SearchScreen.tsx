import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ScoreHit, ScreenProps } from '../contracts';
import { AppError } from '../contracts';
import { TopBar, TextField, Button, Card, Icon, Spinner, ProgressRing, toast } from '../ui';
import { searchCatalog, popularCatalog, searchCommons, downloadScore, linkOuts, normalizeFileUrl } from '../sources';
import { importPdfBytes } from '../library/importPdf';
import { storage } from '../storage';
import { navigate } from '../app/router';
import { t, uk, type StringKey } from '../i18n';
import './Search.css';

const DEBOUNCE_MS = 300;
const MIN_QUERY = 2;
const LINK_HOSTS = ['commons.wikimedia.org', 'imslp.org'];

/** True when the link is https and on one of the allowed hosts. Anything else renders no link. */
export function isSafeLink(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && LINK_HOSTS.includes(u.hostname);
  } catch {
    return false;
  }
}

function errorText(e: unknown, name: string): string {
  if (e instanceof AppError) {
    const key = `error.${e.code}`;
    if (key in uk) return t(key as StringKey, { name });
  }
  return t('error.generic');
}

function sizeText(bytes: number): string {
  if (bytes >= 1024 * 1024) return t('common.sizeMb', { size: (bytes / (1024 * 1024)).toFixed(1) });
  return t('common.sizeKb', { size: Math.max(1, Math.round(bytes / 1024)) });
}

type CardState = 'idle' | 'adding' | 'added';

interface HitCardProps {
  hit: ScoreHit;
  /** Id of the library score made from this file, when it is already there. */
  libraryId: string | null;
}

function HitCard({ hit, libraryId }: HitCardProps) {
  const [state, setState] = useState<CardState>('idle');
  const [addedId, setAddedId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const scoreId = addedId ?? libraryId;
  const effective: CardState = state === 'adding' ? 'adding' : scoreId ? 'added' : state;

  async function add() {
    if (state === 'adding') return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setFailed(false);
    setProgress(0);
    setState('adding');
    try {
      const data = await downloadScore(
        hit,
        (received, total) => setProgress(total ? received / total : 0),
        ctrl.signal,
      );
      const meta = await importPdfBytes(data, {
        title: hit.title,
        composer: hit.composer,
        detail: hit.detail,
        origin: {
          kind: hit.source,
          sourceName: 'Wikimedia Commons',
          license: hit.license,
          pageUrl: hit.pageUrl,
          fileUrl: normalizeFileUrl(hit.fileUrl),
        },
      });
      setAddedId(meta.id);
      setState('added');
      toast(t('library.imported.one', { title: hit.title }), { kind: 'ok' });
    } catch (e) {
      setState('idle');
      if (e instanceof AppError && e.code === 'aborted') return;
      setFailed(true);
      toast(errorText(e, hit.title), { kind: 'error' });
    }
  }

  const link = isSafeLink(hit.pageUrl) ? hit.pageUrl : null;
  const size = hit.sizeBytes !== null ? sizeText(hit.sizeBytes) : hit.pages !== null ? t('common.pages', { count: hit.pages }) : null;

  let action;
  if (hit.fileUrl === null) {
    action = <span class="hit__nofile" data-testid="hit-add">{t('search.noFile')}</span>;
  } else if (effective === 'adding') {
    action = (
      <span class="hit__adding" data-testid="hit-add" role="status">
        <ProgressRing value={progress} size={40} />
        <span>{t('search.adding')}</span>
      </span>
    );
  } else if (effective === 'added' && scoreId) {
    action = (
      <Button variant="primary" data-testid="hit-add" onClick={() => navigate(`/score/${scoreId}`)}>
        {t('search.open')}
      </Button>
    );
  } else {
    action = (
      <Button variant="primary" icon="plus" data-testid="hit-add" onClick={() => void add()}>
        {t('search.add')}
      </Button>
    );
  }

  return (
    <div class="ui-card hit" data-testid="hit-card" data-source={hit.source}>
      <div class="hit__card">
        <div class="hit__body">
          <h3 class="hit__title">{hit.title}</h3>
          {hit.composer ? <p class="hit__composer">{hit.composer}</p> : null}
          {hit.detail ? <p class="hit__detail">{hit.detail}</p> : null}
          <div class="hit__meta">
            <span class="hit__license" data-testid="hit-license">{t('search.license', { license: hit.license })}</span>
            {size ? <span class="hit__size">{size}</span> : null}
            {link ? (
              <a
                class={`hit__source${failed ? ' hit__source--strong' : ''}`}
                href={link}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('search.openSource')}
                <Icon name="external" size={16} />
              </a>
            ) : null}
          </div>
        </div>
        <div class="hit__action">{action}</div>
      </div>
    </div>
  );
}

type CommonsStatus = 'idle' | 'loading' | 'done' | 'offline' | 'failed';

export default function SearchScreen(_props: ScreenProps) {
  const [query, setQuery] = useState('');
  const [commons, setCommons] = useState<ScoreHit[]>([]);
  const [status, setStatus] = useState<CommonsStatus>('idle');
  const [library, setLibrary] = useState<Map<string, string>>(new Map());

  const q = query.trim();
  const searching = q.length >= MIN_QUERY;

  // Files already in the library, by file URL.
  useEffect(() => {
    let alive = true;
    const load = () => {
      storage
        .listScores()
        .then((list) => {
          if (!alive) return;
          const map = new Map<string, string>();
          for (const s of list) if (s.origin.fileUrl) map.set(normalizeFileUrl(s.origin.fileUrl), s.id);
          setLibrary(map);
        })
        .catch(() => undefined);
    };
    load();
    const off = storage.subscribe(load);
    return () => {
      alive = false;
      off();
    };
  }, []);

  const popular = useMemo(() => popularCatalog(12), []);
  const catalogHits = useMemo(() => (searching ? searchCatalog(q) : []), [q, searching]);

  // Commons search: debounced, and the older request is aborted.
  useEffect(() => {
    setCommons([]);
    if (!searching) {
      setStatus('idle');
      return;
    }
    setStatus('loading');
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      searchCommons(q, ctrl.signal)
        .then((hits) => {
          if (ctrl.signal.aborted) return;
          setCommons(hits);
          setStatus('done');
        })
        .catch((e: unknown) => {
          if (ctrl.signal.aborted) return;
          if (e instanceof AppError && e.code === 'aborted') return;
          setCommons([]);
          setStatus(e instanceof AppError && e.code === 'offline' ? 'offline' : 'failed');
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q, searching]);

  const catalogUrls = useMemo(
    () => new Set(catalogHits.map((h) => normalizeFileUrl(h.fileUrl)).filter((u): u is string => !!u)),
    [catalogHits],
  );
  const commonsHits = useMemo(
    () => commons.filter((h) => !h.fileUrl || !catalogUrls.has(normalizeFileUrl(h.fileUrl))),
    [commons, catalogUrls],
  );

  const finished = status === 'done' || status === 'offline' || status === 'failed';
  const nothing = searching && finished && status === 'done' && catalogHits.length === 0 && commonsHits.length === 0;
  const outs = useMemo(() => (q ? linkOuts(q) : linkOuts('')), [q]);

  const libraryId = (hit: ScoreHit) => (hit.fileUrl ? library.get(normalizeFileUrl(hit.fileUrl)) ?? null : null);

  return (
    <main class="screen" data-testid="screen-search">
      <div class="screen-inner">
        <TopBar title={t('search.title')} back="/" serif />
        <div class="search">
          <TextField
            label={t('search.placeholder')}
            value={query}
            onInput={setQuery}
            placeholder={t('search.placeholder')}
            icon="search"
            autofocus
            class="search__field"
            data-testid="search-input"
          />
          {!searching ? <p class="search__hint">{t('search.hint')}</p> : null}

          {!searching ? (
            <section class="search__section">
              <h2 class="search__heading">{t('search.popular')}</h2>
              <div class="search__list">
                {popular.map((h) => (
                  <HitCard key={`${h.source}:${h.id}`} hit={h} libraryId={libraryId(h)} />
                ))}
              </div>
              <p class="search__note" data-testid="search-note">{t('search.note')}</p>
            </section>
          ) : (
            <>
              {catalogHits.length > 0 ? (
                <section class="search__section" data-testid="section-catalog">
                  <h2 class="search__heading">{t('search.section.catalog')}</h2>
                  <div class="search__list">
                    {catalogHits.map((h) => (
                      <HitCard key={`${h.source}:${h.id}`} hit={h} libraryId={libraryId(h)} />
                    ))}
                  </div>
                </section>
              ) : null}

              {status === 'loading' ? (
                <div class="search__status" data-testid="search-loading" role="status">
                  <Spinner size={20} />
                  <span>{t('search.searching')}</span>
                </div>
              ) : null}

              {status === 'offline' ? (
                <p class="search__message" data-testid="search-offline" role="status">
                  <Icon name="wifiOff" size={20} />
                  <span>{t('search.needsInternet')}</span>
                </p>
              ) : null}

              {status === 'failed' ? (
                <p class="search__message" data-testid="search-failed" role="status">
                  <Icon name="alert" size={20} />
                  <span>{t('search.commonsFailed')}</span>
                </p>
              ) : null}

              {commonsHits.length > 0 ? (
                <section class="search__section" data-testid="section-commons">
                  <h2 class="search__heading">{t('search.section.commons')}</h2>
                  <div class="search__list">
                    {commonsHits.map((h) => (
                      <HitCard key={`${h.source}:${h.id}`} hit={h} libraryId={libraryId(h)} />
                    ))}
                  </div>
                </section>
              ) : null}

              {nothing ? (
                <div class="search__empty" data-testid="search-empty">
                  <p>{t('search.empty')}</p>
                  <p class="search__note" data-testid="search-note">{t('search.note')}</p>
                </div>
              ) : null}
            </>
          )}

          <Card class="search__outs">
            <div class="search__outs-body">
              <h2 class="search__heading">{t('search.linkouts.title')}</h2>
              <div class="search__outs-links">
                {outs.map((o) =>
                  isSafeLink(o.url) ? (
                    <a
                      key={o.id}
                      class="search__outlink"
                      href={o.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid={`linkout-${o.id}`}
                    >
                      {o.label}
                      <Icon name="external" size={16} />
                    </a>
                  ) : null,
                )}
              </div>
              <p class="search__note">{t('search.linkouts.hint')}</p>
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
