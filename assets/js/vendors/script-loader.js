const loadingScripts = new Map();

export function loadScriptOnce(src, { id, integrity, crossOrigin } = {}) {
  const key = id || src;
  if (loadingScripts.has(key)) {
    return loadingScripts.get(key);
  }

  const promise = new Promise((resolve, reject) => {
    const existing = id ? document.getElementById(id) : document.querySelector(`script[src="${src}"]`);

    if (existing) {
      if (existing.dataset.loaded === 'true') {
        resolve(existing);
        return;
      }

      existing.addEventListener('load', () => {
        existing.dataset.loaded = 'true';
        resolve(existing);
      }, { once: true });

      existing.addEventListener('error', () => {
        loadingScripts.delete(key);
        reject(new Error(`Failed to load script: ${src}`));
      }, { once: true });

      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    if (id) script.id = id;
    if (integrity) script.integrity = integrity;
    if (crossOrigin) script.crossOrigin = crossOrigin;

    script.addEventListener('load', () => {
      script.dataset.loaded = 'true';
      resolve(script);
    }, { once: true });

    script.addEventListener('error', () => {
      loadingScripts.delete(key);
      reject(new Error(`Failed to load script: ${src}`));
    }, { once: true });

    document.head.appendChild(script);
  });

  loadingScripts.set(key, promise);
  return promise;
}
