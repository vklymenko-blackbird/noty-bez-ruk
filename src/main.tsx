import { render } from 'preact';
import './styles/tokens.css';
import './styles/fonts.css';
import './styles/base.css';
import './styles/components.css';
import { App } from './app/App';
import { installTestHook } from './app/testHook';
import { isTestMode, testFlag } from './app/testMode';
import { initPwa } from './pwa';

if (isTestMode()) installTestHook();

const root = document.getElementById('app');
if (root) render(<App />, root);

if (!isTestMode() || testFlag('sw')) {
  initPwa({ isPlayRoute: () => location.hash.startsWith('#/play/') });
}
