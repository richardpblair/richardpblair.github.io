import { loadScriptOnce } from './script-loader.js';

const GLIGHTBOX_SCRIPT_ID = 'glightbox-lib';

export async function loadGLightbox() {
  if (typeof window.GLightbox === 'function') {
    return window.GLightbox;
  }

  await loadScriptOnce('assets/vendor/glightbox/js/glightbox.min.js', { id: GLIGHTBOX_SCRIPT_ID });

  if (typeof window.GLightbox !== 'function') {
    throw new Error('GLightbox failed to load.');
  }

  return window.GLightbox;
}
