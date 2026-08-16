'use strict';
/* Charge le vrai code d'Économat Pro (extrait de ../index.html) dans un contexte VM avec DOM factice */
const vm = require('vm'), fs = require('fs'), path = require('path');

function extraireScript() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const i = html.lastIndexOf('<script>');
  const j = html.indexOf('</script>', i);
  return html.slice(i + 8, j);
}
function fakeElFactory() {
  function fakeEl(tag) {
    const el = {
      tag: tag || 'div', attrs: {}, children: [], style: {}, value: '', textContent: '', className: '', dataset: {}, parentNode: null,
      classList: {
        _s: new Set(),
        add(...a) { a.forEach((x) => el.classList._s.add(x)); },
        remove(...a) { a.forEach((x) => el.classList._s.delete(x)); },
        toggle(c, f) { if (f === undefined) f = !el.classList._s.has(c); f ? el.classList._s.add(c) : el.classList._s.delete(c); return f; },
        contains(c) { return el.classList._s.has(c); }
      },
      addEventListener() {}, removeEventListener() {}, setAttribute(k, v) { el.attrs[k] = String(v); },
      appendChild(c) { el.children.push(c); c.parentNode = el; return c; },
      removeChild(c) { const i = el.children.indexOf(c); if (i >= 0) el.children.splice(i, 1); },
      remove() { if (el.parentNode) el.parentNode.removeChild(el); },
      click() {},
      get firstChild() { return el.children[0] || null; },
      querySelectorAll() { return []; }, querySelector() { return null; },
    };
    Object.defineProperty(el, 'innerHTML', { get() { return el._html || ''; }, set(v) { el.children.length = 0; el._html = v; } });
    Object.defineProperty(el, 'outerHTML', { get() { return el._html || ''; }, set(v) { el._html = v; } });
    return el;
  }
  return fakeEl;
}
function chargerContexte(options) {
  options = options || {};
  const fakeEl = fakeElFactory(), els = {};
  const corps = fakeEl('body');
  const sandbox = {
    console, URLSearchParams, process,
    /* par défaut les timers ne se déclenchent jamais : les tests pilotent l'état directement */
    setTimeout: options.setTimeout || (() => ({})),
    setInterval: options.setInterval || (() => ({})),
    clearTimeout: () => {}, clearInterval: () => {},
    TextDecoder, TextEncoder, Blob, Response, DecompressionStream,
    document: {
      getElementById: (id) => els[id] || (els[id] = fakeEl('div')),
      querySelectorAll: () => [], querySelector: () => null,
      createElement: (t) => fakeEl(t), createElementNS: (ns, t) => fakeEl(t),
      addEventListener() {}, hidden: false, visibilityState: 'visible',
      body: corps,
    },
    window: { open() {}, addEventListener() {}, scrollTo() {}, print() {} },
    navigator: {},
    location: { search: '', origin: 'https://t', pathname: '/' },
  };
  if (options.localStorage) sandbox.localStorage = options.localStorage;
  vm.createContext(sandbox);
  vm.runInContext(extraireScript() + (options.exposer || ''), sandbox);
  sandbox.__els = els;
  return sandbox;
}
module.exports = { chargerContexte, fakeElFactory, extraireScript };
