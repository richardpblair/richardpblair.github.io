import { initBGNet } from './bg-net.js';

const startBackground = () => {
  initBGNet();
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startBackground, { once: true });
} else {
  startBackground();
}
