import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(new URL('./Modal.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023 },
}).outputText;

// Small DOM doubles exercise the production coordinator, not browser layout or
// React's renderer. Only Node built-ins and the project's existing TS compiler.
function harness() {
  const jobs = [];
  const listeners = new Map();
  const observers = [];
  let document;
  class Element {
    constructor(tag = 'div') {
      this.tagName = tag.toUpperCase();
      this.children = [];
      this.parentElement = null;
      this.attributes = new Map();
      this.style = {};
      this.tabIndex = ['button', 'input', 'a', 'select', 'textarea'].includes(tag) ? 0 : -1;
      this.disabled = false;
      this.isContentEditable = false;
      this.focusCalls = 0;
      this.focusOptions = [];
    }
    get isConnected() { return this === document.body || !!this.parentElement?.isConnected; }
    append(...elements) {
      for (const element of elements) {
        element.remove();
        element.parentElement = this;
        this.children.push(element);
      }
    }
    insertBefore(element, next) {
      element.remove();
      const index = this.children.indexOf(next);
      assert.notEqual(index, -1);
      element.parentElement = this;
      this.children.splice(index, 0, element);
    }
    remove() {
      if (this.parentElement) {
        this.parentElement.children.splice(this.parentElement.children.indexOf(this), 1);
        this.parentElement = null;
      }
    }
    contains(element) { return this === element || this.children.some((child) => child.contains(element)); }
    setAttribute(name, value) {
      this.attributes.set(name, String(value));
      if (name === 'tabindex') this.tabIndex = Number(value);
    }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    hasAttribute(name) { return this.attributes.has(name); }
    removeAttribute(name) {
      this.attributes.delete(name);
      if (name === 'tabindex') this.tabIndex = ['BUTTON', 'INPUT', 'A', 'SELECT', 'TEXTAREA'].includes(this.tagName) ? 0 : -1;
    }
    closest() {
      if (this.hasAttribute('inert') || this.hasAttribute('hidden') || this.getAttribute('aria-hidden') === 'true') return this;
      return this.parentElement?.closest() ?? null;
    }
    matches() { return this.disabled || (this.tagName === 'INPUT' && this.type === 'hidden'); }
    getClientRects() {
      for (let node = this; node; node = node.parentElement) {
        if (node.style.display === 'none') return [];
      }
      return this.isConnected ? [{}] : [];
    }
    querySelectorAll() {
      return this.children.flatMap((child) => [child, ...child.querySelectorAll()]);
    }
    compareDocumentPosition(other) {
      assert.equal(this.parentElement, other.parentElement);
      return this.parentElement.children.indexOf(this) < this.parentElement.children.indexOf(other) ? 4 : 2;
    }
    focus(options) {
      this.focusCalls++;
      this.focusOptions.push(options);
      if (!this.isConnected || this.closest() || this.matches() || !this.getClientRects().length ||
        ['hidden', 'collapse'].includes(computedStyle(this).visibility)) return;
      if (this.tabIndex < 0 && !this.hasAttribute('tabindex') && !this.isContentEditable) return;
      document.activeElement = this;
      for (const listener of listeners.get('focusin') ?? []) listener({ target: this });
    }
  }
  class Input extends Element {
    constructor(type = 'text', name = '') {
      super('input');
      this.type = type;
      this.name = name;
      this.form = null;
      this.checked = false;
    }
  }
  function computedStyle(element) {
    let visibility = 'visible';
    for (let node = element; node; node = node.parentElement) {
      if (node.style.visibility) { visibility = node.style.visibility; break; }
    }
    return { zIndex: String(element.style.zIndex ?? 1000), visibility };
  }
  document = {
    body: new Element('body'),
    activeElement: null,
    addEventListener(name, listener) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(listener);
    },
    removeEventListener(name, listener) { listeners.get(name)?.delete(listener); },
  };
  document.activeElement = document.body;
  const refs = [];
  let refIndex = 0;
  let effects = [];
  const react = {
    createContext: () => ({ Provider: 'Provider' }),
    useContext: () => null,
    useId: () => 'component-modal',
    useRef: (initial) => refs[refIndex++] ?? (refs[refIndex - 1] = { current: initial }),
    useLayoutEffect: (effect) => effects.push(effect),
  };
  const exports = {};
  vm.runInNewContext(`${compiled}\nexports.coordinator = { registerModal, unregisterModal, topModal, tabStops, syncIsolation };`, {
    exports,
    require(name) {
      if (name === 'react') return react;
      if (name === 'react-dom') return { createPortal: (children, container) => ({ children, container }) };
      if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }) };
      throw new Error(`Unexpected import: ${name}`);
    },
    document,
    HTMLElement: Element,
    HTMLInputElement: Input,
    Node: { DOCUMENT_POSITION_FOLLOWING: 4 },
    getComputedStyle: computedStyle,
    queueMicrotask: (job) => jobs.push(job),
    MutationObserver: class {
      constructor(callback) { this.callback = callback; observers.push(this); }
      observe() { this.active = true; }
      disconnect() { this.active = false; }
    },
  });
  const api = exports.coordinator;
  const background = new Element('main');
  const opener = new Element('button');
  document.body.append(background);
  background.append(opener);
  opener.focus();
  function addModal({ id, parentId = null, zIndex = 1000, onClose = () => {}, opener: origin = document.activeElement } = {}) {
    const overlay = new Element();
    overlay.style.zIndex = zIndex;
    const content = new Element();
    content.setAttribute('tabindex', '-1');
    overlay.append(content);
    document.body.append(overlay);
    const modal = { id, parentId, overlay, content, opener: origin, close: onClose };
    api.registerModal(modal);
    return modal;
  }
  function flush() { while (jobs.length) jobs.shift()(); }
  function removeModal(modal, flushNow = true) {
    api.unregisterModal(modal);
    if (modal.overlay.contains(document.activeElement)) document.activeElement = document.body;
    modal.overlay.remove();
    if (flushNow) flush();
  }
  function key(key, shiftKey = false, isComposing = false) {
    const event = { key, shiftKey, isComposing, prevented: false, stopped: false,
      preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; } };
    for (const listener of [...(listeners.get('keydown') ?? [])]) listener(event);
    return event;
  }
  function render(props) {
    refIndex = 0;
    effects = [];
    const portal = exports.Modal(props);
    const overlay = portal.children.props.children;
    return { portal, overlay, content: overlay.props.children, effects: [...effects] };
  }
  return { ...api, document, background, opener, Element, Input, listeners, observers,
    addModal, removeModal, flush, key, render,
    mutateBody() { for (const observer of observers) if (observer.active) observer.callback(); },
  };
}

test('one keyboard boundary closes only the painted topmost modal, honoring explicit z-index', () => {
  const h = harness();
  const closed = [];
  const high = h.addModal({ id: 'high', zIndex: 999999, onClose: () => closed.push('high') });
  const low = h.addModal({ id: 'low', onClose: () => closed.push('low') });
  assert.equal(h.topModal(), high);
  assert.equal(h.document.activeElement, high.content);
  assert.equal(h.listeners.get('keydown').size, 1);
  assert.equal(h.key('Escape').prevented, true);
  assert.deepEqual(closed, ['high']);
  h.key('Escape', false, true);
  assert.deepEqual(closed, ['high']);
  low.overlay.style.zIndex = 1000000;
  h.syncIsolation();
  h.key('Escape');
  assert.deepEqual(closed, ['high', 'low']);
});

test('synchronous Escape teardown does not dismiss the newly exposed underlying modal', () => {
  const h = harness();
  const closed = [];
  const parent = h.addModal({ id: 'parent', onClose: () => closed.push('parent') });
  const child = h.addModal({ id: 'child', parentId: parent.id, onClose: () => {
    closed.push('child');
    h.removeModal(child);
  } });
  h.key('Escape');
  assert.deepEqual(closed, ['child']);
  h.key('Escape');
  assert.deepEqual(closed, ['child', 'parent']);
});

test('Tab and Shift+Tab cycle both boundaries, recover outside focus, and handle empty dialogs', () => {
  const h = harness();
  const modal = h.addModal({ id: 'focus' });
  const first = new h.Element('button');
  const last = new h.Element('button');
  modal.content.append(first, last);
  h.key('Tab');
  assert.equal(h.document.activeElement, first);
  h.key('Tab', true);
  assert.equal(h.document.activeElement, last);
  h.key('Tab');
  assert.equal(h.document.activeElement, first);
  h.document.activeElement = h.opener;
  h.key('Tab', true);
  assert.equal(h.document.activeElement, last);
  first.remove();
  last.remove();
  h.key('Tab');
  assert.equal(h.document.activeElement, modal.content);
  h.key('Tab', true);
  assert.equal(h.document.activeElement, modal.content);
  h.document.activeElement = h.opener;
  for (const listener of h.listeners.get('focusin')) listener();
  assert.equal(h.document.activeElement, modal.content);
});

test('keyboard focus permits native scrolling while initial and return focus preserve positioning', () => {
  const h = harness();
  const modal = h.addModal({ id: 'scrollable-dialog' });
  modal.content.style.overflowY = 'auto';
  modal.content.style.maxHeight = '85vh';
  const first = new h.Element('button');
  const last = new h.Element('button');
  modal.content.append(first, last);
  assert.equal(modal.content.focusOptions.at(-1)?.preventScroll, true);

  // Inspect the actual focus options, not a simulated scroll result: this DOM
  // double cannot verify that a browser reveals an offscreen control.
  function tabTo(target, shiftKey = false) {
    const before = target.focusCalls;
    h.key('Tab', shiftKey);
    assert.equal(h.document.activeElement, target);
    assert.equal(target.focusCalls, before + 1);
    assert.notEqual(target.focusOptions.at(-1)?.preventScroll, true);
  }
  tabTo(first);
  tabTo(last);
  tabTo(first);
  tabTo(last, true);
  tabTo(first, true);
  first.remove();
  last.remove();
  tabTo(modal.content);
  tabTo(modal.content, true);

  h.removeModal(modal);
  assert.equal(h.document.activeElement, h.opener);
  assert.equal(h.opener.focusOptions.at(-1)?.preventScroll, true);
});

test('tab order excludes unavailable controls and respects positive tabindex, editable content, and radios', () => {
  const h = harness();
  const modal = h.addModal({ id: 'controls' });
  const regular = new h.Element('button');
  const positive = new h.Element('button');
  positive.setAttribute('tabindex', '2');
  const disabled = new h.Element('button');
  disabled.disabled = true;
  const hidden = new h.Input('hidden');
  const negative = new h.Element('button');
  negative.setAttribute('tabindex', '-1');
  const invisible = new h.Element('button');
  invisible.style.visibility = 'hidden';
  const collapsed = new h.Element('button');
  collapsed.style.display = 'none';
  const inert = new h.Element();
  inert.setAttribute('inert', '');
  inert.append(new h.Element('button'));
  const editable = new h.Element();
  editable.isContentEditable = true;
  const radioA = new h.Input('radio', 'answer');
  const radioB = new h.Input('radio', 'answer');
  radioB.checked = true;
  modal.content.append(regular, disabled, positive, hidden, negative, invisible, collapsed, inert, editable, radioA, radioB);
  assert.deepEqual(Array.from(h.tabStops(modal.content)), [positive, regular, editable, radioB]);
  radioB.checked = false;
  assert.deepEqual(Array.from(h.tabStops(modal.content)), [positive, regular, editable, radioA]);
});

test('background, underlying overlays, and new body content stay inert with exact restoration', () => {
  const h = harness();
  const alreadyInert = new h.Element();
  alreadyInert.setAttribute('inert', 'original');
  h.document.body.append(alreadyInert);
  const parent = h.addModal({ id: 'parent' });
  const child = h.addModal({ id: 'child', parentId: parent.id });
  const inserted = new h.Element();
  h.document.body.append(inserted);
  h.mutateBody();
  assert.equal(h.background.hasAttribute('inert'), true);
  assert.equal(parent.overlay.hasAttribute('inert'), true);
  assert.equal(child.overlay.hasAttribute('inert'), false);
  assert.equal(inserted.hasAttribute('inert'), true);
  inserted.remove();
  h.mutateBody();
  assert.equal(inserted.hasAttribute('inert'), false);
  h.removeModal(child);
  assert.equal(parent.overlay.hasAttribute('inert'), false);
  assert.equal(h.background.hasAttribute('inert'), true);
  h.removeModal(parent);
  assert.equal(h.background.hasAttribute('inert'), false);
  assert.equal(alreadyInert.getAttribute('inert'), 'original');
  assert.equal(h.listeners.get('keydown').size, 0);
  assert.equal(h.listeners.get('focusin').size, 0);
  assert.equal(h.observers.some((observer) => observer.active), false);
});

test('nested confirmations restore their connected opener, then the external opener', () => {
  const h = harness();
  const parent = h.addModal({ id: 'parent' });
  const button = new h.Element('button');
  parent.content.append(button);
  button.focus();
  const child = h.addModal({ id: 'child', parentId: parent.id });
  h.removeModal(child);
  assert.equal(h.document.activeElement, button);
  h.removeModal(parent);
  assert.equal(h.document.activeElement, h.opener);
});

test('out-of-order parent teardown preserves the surviving child focus and external return path', () => {
  const h = harness();
  const parent = h.addModal({ id: 'parent' });
  const button = new h.Element('button');
  parent.content.append(button);
  button.focus();
  const child = h.addModal({ id: 'child', parentId: parent.id });
  h.removeModal(parent);
  assert.equal(h.document.activeElement, child.content);
  h.removeModal(child);
  assert.equal(h.document.activeElement, h.opener);
});

test('whole nested stacks return to the external opener in either cleanup order', () => {
  for (const parentFirst of [true, false]) {
    const h = harness();
    const parent = h.addModal({ id: 'parent' });
    const button = new h.Element('button');
    parent.content.append(button);
    button.focus();
    const child = h.addModal({ id: 'child', parentId: parent.id });
    for (const modal of parentFirst ? [parent, child] : [child, parent]) h.removeModal(modal, false);
    h.flush();
    assert.equal(h.document.activeElement, h.opener);
    assert.equal(h.background.hasAttribute('inert'), false);
    assert.equal(h.listeners.get('keydown').size, 0);
  }
});

test('detached, hidden, disabled, and still-inert openers are never focused on return', () => {
  for (const invalidate of [
    (h) => h.opener.remove(),
    (h) => h.opener.setAttribute('hidden', ''),
    (h) => { h.opener.disabled = true; },
    (h) => h.opener.setAttribute('inert', 'external'),
    (h) => { h.opener.style.visibility = 'hidden'; },
  ]) {
    const h = harness();
    const modal = h.addModal({ id: 'invalid-opener' });
    invalidate(h);
    const before = h.opener.focusCalls;
    h.removeModal(modal);
    assert.equal(h.opener.focusCalls, before);
  }
});

test('a connected opener that loses its programmatic focusability is not focused', () => {
  const h = harness();
  const opener = new h.Element();
  opener.setAttribute('tabindex', '-1');
  h.background.append(opener);
  opener.focus();
  const modal = h.addModal({ id: 'no-longer-focusable' });
  opener.removeAttribute('tabindex');
  const before = opener.focusCalls;
  h.removeModal(modal);
  assert.equal(opener.focusCalls, before);
});

test('a missing confirmation opener falls back to its underlying dialog, not the background', () => {
  const h = harness();
  const parent = h.addModal({ id: 'parent' });
  const button = new h.Element('button');
  parent.content.append(button);
  button.focus();
  const child = h.addModal({ id: 'child', parentId: parent.id });
  button.remove();
  h.removeModal(child);
  assert.equal(h.document.activeElement, parent.content);
});

test('child-first layout registration keeps nested equal-z-index portals above their parents', () => {
  const h = harness();
  const child = h.addModal({ id: 'child', parentId: 'parent' });
  const parent = h.addModal({ id: 'parent', opener: h.opener });
  assert.equal(h.topModal(), child);
  assert.equal(parent.overlay.compareDocumentPosition(child.overlay), 4);
  assert.equal(parent.overlay.hasAttribute('inert'), true);
  h.removeModal(child);
  assert.equal(h.document.activeElement, parent.content);
  h.removeModal(parent);
  assert.equal(h.document.activeElement, h.opener);
});

test('StrictMode-style replay of a lower sibling cannot change paint priority or steal focus', () => {
  const h = harness();
  const lower = h.addModal({ id: 'lower' });
  const button = new h.Element('button');
  lower.content.append(button);
  button.focus();
  const upper = h.addModal({ id: 'upper' });
  h.unregisterModal(lower);
  h.registerModal(lower);
  h.flush();
  assert.equal(h.topModal(), upper);
  assert.equal(h.document.activeElement, upper.content);
  assert.equal(h.listeners.get('keydown').size, 1);
  h.removeModal(upper);
  assert.equal(h.document.activeElement, button);
  h.removeModal(lower);
});

test('stale queued focus restoration cannot steal focus from a newly opened modal', () => {
  const h = harness();
  const first = h.addModal({ id: 'first' });
  h.removeModal(first, false);
  const second = h.addModal({ id: 'second' });
  h.flush();
  assert.equal(h.document.activeElement, second.content);
  assert.equal(h.background.hasAttribute('inert'), true);
});

test('component portals preserve its API and latest close callback across effect replay', () => {
  const h = harness();
  const calls = [];
  const props = { onClose: () => calls.push('old'), ariaLabel: 'Accessible dialog', children: 'content',
    overlayStyle: { zIndex: 2000, direction: 'ltr', background: 'transparent' }, contentStyle: { outline: 'solid', padding: 12 } };
  const view = h.render(props);
  assert.equal(view.portal.container, h.document.body);
  assert.equal(view.overlay.props.style.direction, 'ltr');
  assert.equal(view.overlay.props.style.zIndex, 2000);
  assert.equal(view.content.props.role, 'dialog');
  assert.equal(view.content.props['aria-modal'], 'true');
  assert.equal(view.content.props['aria-label'], props.ariaLabel);
  assert.equal(view.content.props.style.outline, 'solid');
  assert.equal(view.content.props.children, 'content');
  const overlay = new h.Element();
  overlay.style = view.overlay.props.style;
  const content = new h.Element();
  content.setAttribute('tabindex', '-1');
  overlay.append(content);
  h.document.body.append(overlay);
  view.overlay.props.ref.current = overlay;
  view.content.props.ref.current = content;
  view.effects[0]();
  let cleanup = view.effects[1]();
  view.effects[2]();
  cleanup();
  cleanup = view.effects[1]();
  h.flush();
  assert.equal(h.document.activeElement, content);
  assert.equal(h.listeners.get('keydown').size, 1);
  const updated = h.render({ ...props, onClose: () => calls.push('latest') });
  updated.effects[0]();
  updated.effects[2]();
  const backdrop = { target: overlay, currentTarget: overlay, stopPropagation() { this.stopped = true; } };
  updated.overlay.props.onMouseDown(backdrop);
  assert.equal(backdrop.stopped, true);
  updated.overlay.props.onMouseDown({ ...backdrop, target: content });
  assert.deepEqual(calls, ['latest']);
  const confirmation = h.addModal({ id: 'confirmation', zIndex: 999999, onClose: () => calls.push('confirmation') });
  updated.overlay.props.onMouseDown(backdrop);
  assert.deepEqual(calls, ['latest']);
  h.key('Escape');
  assert.deepEqual(calls, ['latest', 'confirmation']);
  h.removeModal(confirmation);
  cleanup();
  overlay.remove();
  h.flush();
  assert.equal(h.document.activeElement, h.opener);
  assert.equal(h.background.hasAttribute('inert'), false);
  assert.equal(h.listeners.get('keydown').size, 0);
});
