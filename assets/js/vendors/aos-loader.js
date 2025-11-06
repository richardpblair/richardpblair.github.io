import { loadScriptOnce } from './script-loader.js';

const AOS_SCRIPT_ID = 'aos-lib';

export async function loadAOS() {
  if (window.AOS) {
    return window.AOS;
  }

  await loadScriptOnce('assets/vendor/aos/aos.js', { id: AOS_SCRIPT_ID });

  if (!window.AOS) {
    throw new Error('AOS failed to load.');
  }

  return window.AOS;
}
