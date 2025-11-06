(function() {
"use strict";
const prefersReducedMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;
const hasCoarsePointer = window.matchMedia ? window.matchMedia('(pointer: coarse)').matches : false;
const headerToggleBtn = document.querySelector('.header-toggle');
const siteHeader = document.querySelector('#header') || document.querySelector('.header');
if (headerToggleBtn && siteHeader) {
let navBackdrop = document.querySelector('.nav-backdrop');
if (!navBackdrop) {
navBackdrop = document.createElement('div');
navBackdrop.className = 'nav-backdrop';
navBackdrop.setAttribute('aria-hidden', 'true');
document.body.appendChild(navBackdrop);
}
const syncToggleState = (isExpanded) => {
headerToggleBtn.classList.toggle('bi-list', !isExpanded);
headerToggleBtn.classList.toggle('bi-x', isExpanded);
headerToggleBtn.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
headerToggleBtn.setAttribute('aria-label', isExpanded ? 'Close navigation' : 'Open navigation');
document.body.classList.toggle('nav-open', isExpanded);
navBackdrop.classList.toggle('active', isExpanded);
};
function headerToggle() {
const isExpanded = siteHeader.classList.toggle('header-show');
syncToggleState(isExpanded);
}
headerToggleBtn.addEventListener('click', headerToggle);
navBackdrop.addEventListener('click', headerToggle);
document.querySelectorAll('#navmenu a').forEach(navmenu => {
navmenu.addEventListener('click', () => {
if (siteHeader.classList.contains('header-show')) {
headerToggle();
}
});
});
document.addEventListener('keydown', (event) => {
if (event.key === 'Escape' && siteHeader.classList.contains('header-show')) {
headerToggle();
}
});
window.addEventListener('resize', () => {
if (window.innerWidth >= 1200 && siteHeader.classList.contains('header-show')) {
siteHeader.classList.remove('header-show');
syncToggleState(false);
}
});
syncToggleState(siteHeader.classList.contains('header-show'));
}
document.querySelectorAll('.navmenu .toggle-dropdown').forEach(navmenu => {
navmenu.addEventListener('click', function(e) {
e.preventDefault();
this.parentNode.classList.toggle('active');
this.parentNode.nextElementSibling.classList.toggle('dropdown-active');
e.stopImmediatePropagation();
});
});
const preloader = document.querySelector('#preloader');
if (preloader) {
window.addEventListener('load', () => {
preloader.remove();
});
}
let scrollTop = document.querySelector('.scroll-top');
function toggleScrollTop() {
if (scrollTop) {
window.scrollY > 100 ? scrollTop.classList.add('active') : scrollTop.classList.remove('active');
}
}
scrollTop.addEventListener('click', (e) => {
e.preventDefault();
window.scrollTo({
top: 0,
behavior: 'smooth'
});
});
window.addEventListener('load', toggleScrollTop);
document.addEventListener('scroll', toggleScrollTop);
function lazyLoadOnIntersection(elements, callback, options = {}) {
if (!elements.length) return;
let hasLoaded = false;
const load = () => {
if (hasLoaded) return;
hasLoaded = true;
callback();
};
const { rootMargin = '0px 0px 0px 0px' } = options;
if ('IntersectionObserver' in window) {
const observer = new IntersectionObserver((entries, obs) => {
entries.forEach((entry) => {
if (entry.isIntersecting || entry.intersectionRatio > 0) {
obs.disconnect();
load();
}
});
}, { rootMargin });
elements.forEach((el) => observer.observe(el));
} else {
load();
}
}
function configureAOS() {
if (prefersReducedMotion || hasCoarsePointer) return;
const aosElements = document.querySelectorAll('[data-aos]');
if (!aosElements.length) return;
let loadPromise;
const loadAndInit = () => {
if (loadPromise) return loadPromise;
loadPromise = import('/assets/js/vendors/aos-loader.js')
.then(({ loadAOS }) => loadAOS())
.then((AOS) => {
AOS.init({
duration: 600,
easing: 'ease-in-out',
once: true,
mirror: false
});
})
.catch((error) => {
console.error('Failed to initialise AOS', error);
});
return loadPromise;
};
lazyLoadOnIntersection(aosElements, loadAndInit, { rootMargin: '200px 0px' });
}
configureAOS();
function configureGLightbox() {
const glightboxElements = document.querySelectorAll('.glightbox');
if (!glightboxElements.length) return;
let loadPromise;
const loadAndInit = () => {
if (loadPromise) return loadPromise;
loadPromise = import('/assets/js/vendors/glightbox-loader.js')
.then(({ loadGLightbox }) => loadGLightbox())
.then((GLightbox) => {
if (typeof GLightbox === 'function') {
GLightbox({ selector: '.glightbox' });
}
})
.catch((error) => {
console.error('Failed to initialise GLightbox', error);
});
return loadPromise;
};
lazyLoadOnIntersection(glightboxElements, loadAndInit, { rootMargin: '200px 0px' });
const eagerLoad = () => {
loadAndInit();
};
glightboxElements.forEach((el) => {
el.addEventListener('click', eagerLoad, { once: true });
el.addEventListener('pointerenter', eagerLoad, { once: true });
el.addEventListener('focus', eagerLoad, { once: true });
});
}
configureGLightbox();
function initTypedText() {
const typedElement = document.querySelector('.typed');
if (!typedElement) return;
const typedStrings = typedElement.getAttribute('data-typed-items');
if (!typedStrings) return;
const phrases = typedStrings.split(',').map((str) => str.trim()).filter(Boolean);
if (!phrases.length) return;
if (prefersReducedMotion) {
typedElement.textContent = phrases[0];
return;
}
const typeSpeed = Number(typedElement.dataset.typeSpeed || 90);
const backSpeed = Number(typedElement.dataset.backSpeed || 45);
const holdDelay = Number(typedElement.dataset.holdDelay || 2000);
typedElement.setAttribute('aria-live', 'polite');
let phraseIndex = 0;
let charIndex = 0;
let isDeleting = false;
const step = () => {
const phrase = phrases[phraseIndex];
if (isDeleting) {
charIndex = Math.max(charIndex - 1, 0);
} else {
charIndex = Math.min(charIndex + 1, phrase.length);
}
typedElement.textContent = phrase.slice(0, charIndex);
if (!isDeleting && charIndex === phrase.length) {
isDeleting = true;
setTimeout(step, holdDelay);
return;
}
if (isDeleting && charIndex === 0) {
isDeleting = false;
phraseIndex = (phraseIndex + 1) % phrases.length;
}
const delay = isDeleting ? backSpeed : typeSpeed;
setTimeout(step, Math.max(delay, 16));
};
typedElement.textContent = '';
setTimeout(step, typeSpeed);
}
function initCounters() {
const counters = document.querySelectorAll('[data-count]');
if (!counters.length) return;
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
if (prefersReducedMotion) {
counters.forEach((counter) => {
const end = Number(counter.dataset.count);
if (!Number.isNaN(end)) {
counter.textContent = String(end);
}
});
return;
}
const observer = new IntersectionObserver((entries, obs) => {
entries.forEach((entry) => {
if (!entry.isIntersecting) return;
obs.unobserve(entry.target);
const el = entry.target;
const startVal = Number(el.dataset.countStart || 0);
const endVal = Number(el.dataset.count);
if (Number.isNaN(endVal)) return;
const duration = Number(el.dataset.countDuration || 800);
const startTime = performance.now();
const tick = (now) => {
const progress = Math.min((now - startTime) / duration, 1);
const eased = easeOutCubic(progress);
const value = startVal + (endVal - startVal) * eased;
el.textContent = String(Math.round(value));
if (progress < 1) {
requestAnimationFrame(tick);
} else {
el.textContent = String(endVal);
}
};
requestAnimationFrame(tick);
});
}, { threshold: 0.6 });
counters.forEach((counter) => {
if (Number.isNaN(Number(counter.dataset.count))) return;
counter.textContent = counter.dataset.countStart || '0';
observer.observe(counter);
});
}
function initSkillProgress() {
const section = document.querySelector('#skills');
if (!section) return;
const bars = section.querySelectorAll('.progress .progress-bar[aria-valuenow]');
if (!bars.length) return;
const fillBar = (bar) => {
const value = parseFloat(bar.getAttribute('aria-valuenow') || '0');
const clamped = Math.min(Math.max(value, 0), 100);
if (prefersReducedMotion) {
const previousTransition = bar.style.transition;
bar.style.transition = 'none';
bar.style.width = `${clamped}%`;
void bar.offsetWidth;
bar.style.transition = previousTransition || '';
} else {
bar.style.width = `${clamped}%`;
}
bar.dataset.filled = 'true';
};
if (prefersReducedMotion) {
bars.forEach(fillBar);
return;
}
if ('IntersectionObserver' in window) {
const observer = new IntersectionObserver((entries, obs) => {
entries.forEach((entry) => {
if (!entry.isIntersecting) return;
const bar = entry.target;
if (bar.dataset.filled === 'true') {
obs.unobserve(bar);
return;
}
fillBar(bar);
obs.unobserve(bar);
});
}, { threshold: 0.2 });
bars.forEach((bar) => observer.observe(bar));
return;
}
bars.forEach(fillBar);
}
function initPortfolioFilters() {
const filters = document.querySelectorAll('.portfolio-filters [data-filter]');
const container = document.querySelector('.portfolio-container');
if (!filters.length || !container) return;
const items = Array.from(container.querySelectorAll('.portfolio-item'));
if (!items.length) return;
const applyFilter = (filterValue) => {
const key = filterValue === 'all' ? null : filterValue;
items.forEach((item) => {
const categories = (item.dataset.category || '')
.split(',')
.map((str) => str.trim())
.filter(Boolean);
const matches = !key || categories.includes(key);
item.classList.toggle('is-hidden', !matches);
item.setAttribute('aria-hidden', matches ? 'false' : 'true');
});
};
const setActive = (active) => {
filters.forEach((btn) => {
const isActive = btn === active;
btn.classList.toggle('filter-active', isActive);
btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
});
};
filters.forEach((btn) => {
btn.addEventListener('click', () => {
setActive(btn);
applyFilter(btn.dataset.filter || 'all');
});
btn.addEventListener('keydown', (event) => {
if (event.key === 'Enter' || event.key === ' ') {
event.preventDefault();
btn.click();
}
});
});
const initial = Array.from(filters).find((btn) => btn.classList.contains('filter-active')) || filters[0];
if (initial) {
setActive(initial);
applyFilter(initial.dataset.filter || 'all');
}
}
function initSwiper() {
if (typeof Swiper === 'undefined') {
return;
}
document.querySelectorAll(".init-swiper").forEach(function(swiperElement) {
let config = JSON.parse(
swiperElement.querySelector(".swiper-config").innerHTML.trim()
);
if (swiperElement.classList.contains("swiper-tab") && typeof initSwiperWithCustomPagination === 'function') {
initSwiperWithCustomPagination(swiperElement, config);
return;
}
new Swiper(swiperElement, config);
});
}
window.addEventListener("load", initSwiper);
initTypedText();
initCounters();
initSkillProgress();
initPortfolioFilters();
window.addEventListener('load', function(e) {
if (window.location.hash) {
if (document.querySelector(window.location.hash)) {
setTimeout(() => {
let section = document.querySelector(window.location.hash);
let scrollMarginTop = getComputedStyle(section).scrollMarginTop;
window.scrollTo({
top: section.offsetTop - parseInt(scrollMarginTop),
behavior: 'smooth'
});
}, 100);
}
}
});
let navmenulinks = document.querySelectorAll('.navmenu a');
function navmenuScrollspy() {
navmenulinks.forEach(navmenulink => {
if (!navmenulink.hash) return;
let section = document.querySelector(navmenulink.hash);
if (!section) return;
let position = window.scrollY + 200;
if (position >= section.offsetTop && position <= (section.offsetTop + section.offsetHeight)) {
document.querySelectorAll('.navmenu a.active').forEach(link => link.classList.remove('active'));
navmenulink.classList.add('active');
} else {
navmenulink.classList.remove('active');
}
})
}
window.addEventListener('load', navmenuScrollspy);
document.addEventListener('scroll', navmenuScrollspy);
})();
//# sourceMappingURL=main-1675978d.js.map
