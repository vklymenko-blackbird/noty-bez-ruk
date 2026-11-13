import { useEffect } from 'preact/hooks';
import { ToastHost } from '../ui';
import { useSettings } from '../settings';
import { t } from '../i18n';
import { navigate, useRoute } from './router';
import { resolveRoute } from './routes';

export function App() {
  const route = useRoute();
  const s = useSettings();
  const resolved = resolveRoute(route.path);
  const isDev = resolved.path.startsWith('/dev/');
  const needsOnboarding = !s.onboardingDone && resolved.path !== '/onboarding' && !isDev;

  useEffect(() => {
    if (needsOnboarding) navigate('/onboarding', { replace: true });
  }, [needsOnboarding]);

  useEffect(() => {
    document.title = t('app.name');
  }, []);

  if (needsOnboarding) return <ToastHost />;
  const Screen = resolved.component;
  return (
    <>
      <Screen key={resolved.path} params={resolved.params} />
      <ToastHost />
    </>
  );
}
