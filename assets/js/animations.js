const supportsMatchMedia = typeof window !== 'undefined' && typeof window.matchMedia === 'function';

const prefersReducedMotion = supportsMatchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isCoarsePointer = supportsMatchMedia && window.matchMedia('(pointer: coarse)').matches;

function disableAOSWhenMotionLimited() {
  if (!prefersReducedMotion && !isCoarsePointer) {
    return;
  }

  document.querySelectorAll('[data-aos]').forEach((element) => {
    element.removeAttribute('data-aos');
    element.removeAttribute('data-aos-delay');
  });
}

async function initHeroTiltIfPresent() {
  const heroWrapper = document.querySelector('.hero .hero-image .image-wrapper');
  if (!heroWrapper) {
    return;
  }

  if (prefersReducedMotion || isCoarsePointer) {
    return;
  }

  try {
    const module = await import('./hero-tilt.js');
    if (typeof module.initHeroTilt === 'function') {
      module.initHeroTilt(heroWrapper);
    }
  } catch (error) {
    console.warn('Hero tilt module failed to load.', error);
  }
}

function onReady(callback) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback, { once: true });
  } else {
    callback();
  }
}

onReady(() => {
  disableAOSWhenMotionLimited();
  initHeroTiltIfPresent();
});
