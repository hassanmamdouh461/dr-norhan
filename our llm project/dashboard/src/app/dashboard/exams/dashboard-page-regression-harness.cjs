const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('../../../../node_modules/typescript');

// Execute the real page handlers with deterministic hooks, requests and timers.
// This is deliberately not a DOM or browser integration test.
function createPageHarness(filename, exposedNames) {
  const hooks = [];
  const effects = [];
  const timers = new Map();
  const calls = [];
  const errors = [];
  let cursor = 0;
  let dirty = true;
  let state;
  let now = 0;
  let nextTimer = 0;
  const sameDeps = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!hooks[index]) {
        const slot = { value: typeof initial === 'function' ? initial() : initial };
        slot.set = next => {
          const value = typeof next === 'function' ? next(slot.value) : next;
          if (!Object.is(value, slot.value)) { slot.value = value; dirty = true; }
        };
        hooks[index] = slot;
      }
      return [hooks[index].value, hooks[index].set];
    },
    useRef(initial) {
      const index = cursor++;
      if (!hooks[index]) hooks[index] = { current: initial };
      return hooks[index];
    },
    useEffect(effect, deps) {
      const index = cursor++;
      const previous = hooks[index];
      if (!previous || !sameDeps(previous.deps, deps)) {
        const slot = { deps, cleanup: previous?.cleanup };
        hooks[index] = slot;
        effects.push(() => { slot.cleanup?.(); slot.cleanup = effect(); });
      }
    },
    useCallback(callback, deps) {
      const index = cursor++;
      if (!hooks[index] || !sameDeps(hooks[index].deps, deps)) hooks[index] = { callback, deps };
      return hooks[index].callback;
    },
  };
  function request(method, url, body) {
    return new Promise((resolve, reject) => {
      const call = { method, url, body, settled: false };
      call.resolve = value => { call.settled = true; resolve(value); };
      call.reject = error => { call.settled = true; reject(error); };
      calls.push(call);
    });
  }
  const api = {
    api: url => request('GET', url),
    apiGet: url => request('GET', url),
    apiPost: (url, body) => request('POST', url, body),
    apiPatch: (url, body) => request('PATCH', url, body),
    apiDelete: url => request('DELETE', url),
  };
  const context = vm.createContext({
    console: { error: (...args) => errors.push(args) },
    Date, Number, String, Object,
    confirm: () => true,
    fetch: (url, options) => request(options.method, url, options.body),
    setTimeout: (callback, delay) => {
      const id = ++nextTimer;
      timers.set(id, { callback, at: now + delay });
      return id;
    },
    clearTimeout: id => timers.delete(id),
  });
  const modules = new Map();
  function load(file, expose = []) {
    if (modules.has(file)) return modules.get(file);
    let source = fs.readFileSync(file, 'utf8');
    if (expose.length) {
      assert.equal(source.split('\n  return (\n').length, 2, 'Expected one page return');
      source = source.replace('\n  return (\n', `\n  return { ${expose.join(', ')} };\n  return (\n`);
    }
    const output = ts.transpileModule(source, {
      fileName: file,
      compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    const module = { exports: {} };
    const localRequire = name => {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return { jsx() {}, jsxs() {} };
      if (name === '@/lib/api') return api;
      if (name.startsWith('.')) return load(path.resolve(path.dirname(file), `${name}.ts`));
      throw new Error(`Unexpected import: ${name}`);
    };
    vm.runInContext(`(function(require, module, exports) { ${output}\n})`, context, { filename: file })(localRequire, module, module.exports);
    modules.set(file, module.exports);
    return module.exports;
  }
  const Page = load(filename, exposedNames).default;
  function render() {
    cursor = 0;
    dirty = false;
    state = Page();
    while (effects.length) effects.shift()();
  }
  async function flush() {
    for (let i = 0; i < 12; i++) {
      await Promise.resolve();
      if (dirty) render();
    }
  }
  render();
  return {
    get state() { return state; }, calls, errors, flush,
    pending(method, url) {
      const call = calls.find(item => !item.settled && item.method === method && item.url === url);
      assert.ok(call, `Missing pending ${method} ${url}`);
      return call;
    },
    async settle(method, url, value) { this.pending(method, url).resolve(value); await flush(); },
    async advance(ms) {
      const end = now + ms;
      for (;;) {
        const next = [...timers.entries()].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        timers.delete(next[0]);
        now = next[1].at;
        next[1].callback();
        await flush();
      }
      now = end;
      await flush();
    },
  };
}

module.exports = { createPageHarness };
