const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export function initHeroTilt(wrapper) {
  const mainImage = wrapper.querySelector('.main-image');
  if (!mainImage) {
    return;
  }

  const floatingCards = Array.from(wrapper.querySelectorAll('.floating-card'));
  const computedStyles = getComputedStyle(wrapper);

  const maxTilt = parseFloat(computedStyles.getPropertyValue('--tilt-max-deg')) || 16;
  const scaleFactor = parseFloat(computedStyles.getPropertyValue('--tilt-scale')) || 1.02;
  const parallaxShift = parseFloat(computedStyles.getPropertyValue('--parallax-shift')) || 10;
  const damping = parseFloat(computedStyles.getPropertyValue('--tilt-damping')) || 0.15;

  let tiltX = 0;
  let tiltY = 0;
  let rafId = null;

  const applyTilt = () => {
    rafId = null;
    mainImage.style.transform = `rotateX(${tiltY}deg) rotateY(${tiltX}deg) scale(${scaleFactor})`;

    floatingCards.forEach((card, index) => {
      const depthFactor = (index + 1) / (floatingCards.length + 1);
      const offsetX = (-tiltX / maxTilt) * parallaxShift * depthFactor;
      const offsetY = (tiltY / maxTilt) * parallaxShift * depthFactor;
      card.style.setProperty('translate', `${offsetX}px ${offsetY}px`, 'important');
    });
  };

  const scheduleTilt = () => {
    if (rafId !== null) {
      return;
    }
    rafId = requestAnimationFrame(applyTilt);
  };

  const resetTilt = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    tiltX = 0;
    tiltY = 0;
    mainImage.style.transition = `transform ${Math.max(damping, 0.05)}s ease-out`;
    floatingCards.forEach((card) => {
      card.style.removeProperty('translate');
    });
    requestAnimationFrame(() => {
      mainImage.style.transform = 'rotateX(0deg) rotateY(0deg) scale(1)';
    });
    setTimeout(() => {
      mainImage.style.transition = '';
    }, Math.max(damping, 0.05) * 1200);
    wrapper.classList.remove('tilting');
  };

  const handlePointerMove = (event) => {
    const rect = wrapper.getBoundingClientRect();
    const relativeX = (event.clientX - rect.left) / rect.width - 0.5;
    const relativeY = (event.clientY - rect.top) / rect.height - 0.5;

    tiltX = clamp(relativeX * maxTilt * 2, -maxTilt, maxTilt);
    tiltY = clamp(relativeY * -maxTilt * 2, -maxTilt, maxTilt);
    scheduleTilt();
  };

  const handlePointerEnter = (event) => {
    wrapper.classList.add('tilting');
    mainImage.style.transition = '';
    handlePointerMove(event);
  };

  wrapper.addEventListener('pointerenter', handlePointerEnter);
  wrapper.addEventListener('pointermove', handlePointerMove);
  wrapper.addEventListener('pointerleave', resetTilt);
  wrapper.addEventListener('pointercancel', resetTilt);
  wrapper.addEventListener('touchend', resetTilt);
}
