// Carrega os scripts do app (os mesmos do index.html, menos o js/app.js que inicia a tela)
// numa VM isolada, com um DOM mínimo e um localStorage em memória. Sem dependências.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const html = read("index.html");
const scripts = [...html.matchAll(/<script defer src="([^"]+)"/g)].map(m => m[1]);

class FakeClassList {
  constructor() { this.s = new Set(); }
  add(...c) { c.forEach(x => this.s.add(x)); }
  remove(...c) { c.forEach(x => this.s.delete(x)); }
  toggle(c, force) {
    const on = force === undefined ? !this.s.has(c) : !!force;
    if (on) this.s.add(c); else this.s.delete(c);
    return on;
  }
  contains(c) { return this.s.has(c); }
}

class FakeEl {
  constructor(tag = "div", id = "") {
    this.tagName = tag.toUpperCase();
    this.id = id;
    this.classList = new FakeClassList();
    this.style = {};
    this.dataset = {};
    this.attrs = {};
    this.children = [];
    this.listeners = {};
    this.value = "";
    this.textContent = "";
    this._html = "";
    this.disabled = false;
    this.open = false;
    this.checked = false;
    this.selectedIndex = 0;
    this.files = [];
  }
  get className() { return [...this.classList.s].join(" "); }
  set className(v) { this.classList.s = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get innerHTML() { return this._html; }
  set innerHTML(v) { this._html = String(v); this.children = []; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  removeAttribute(k) { delete this.attrs[k]; }
  addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); }
  removeEventListener() {}
  dispatch(type, ev = {}) {
    const e = Object.assign({ target: this, preventDefault() {}, stopPropagation() {} }, ev);
    (this.listeners[type] || []).forEach(fn => fn(e));
    if (typeof this["on" + type] === "function") this["on" + type](e);
  }
  click() { this.dispatch("click"); }
  appendChild(c) { this.children.push(c); return c; }
  append(...c) { c.forEach(x => this.appendChild(x)); }
  remove() {}
  focus() {}
  blur() {}
  scrollTo() {}
  querySelector() { return new FakeEl(); }
  querySelectorAll() { return []; }
}

// Um app novo a cada chamada: estado limpo, sem vazar entre testes.
function loadApp({ base = false, storage = new Map(), hash = "" } = {}) {
  const els = new Map();
  const document = {
    documentElement: new FakeEl("html"),
    body: new FakeEl("body"),
    activeElement: null,
    getElementById(id) {
      if (!els.has(id)) els.set(id, new FakeEl("div", id));
      return els.get(id);
    },
    createElement: tag => new FakeEl(tag),
    querySelector: () => new FakeEl(),
    querySelectorAll: () => [],
    addEventListener() {}
  };
  const location = { hash, href: "http://localhost/" + hash, origin: "http://localhost" };
  const context = vm.createContext({
    console, setTimeout, clearTimeout, Intl, URL,
    document, location,
    history: { replaceState(_s, _t, url) { location.hash = String(url).replace(/^[^#]*/, ""); } },
    navigator: { userAgent: "test", platform: "", maxTouchPoints: 0 },
    addEventListener() {},
    scrollTo() {},
    getComputedStyle: () => ({ getPropertyValue: () => "#000" }),
    matchMedia: () => ({ matches: false }),
    showSaveFilePicker() {},
    localStorage: {
      getItem: key => (storage.has(key) ? storage.get(key) : null),
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: key => storage.delete(key)
    }
  });
  context.window = context;
  context.self = context;
  for (const file of scripts.filter(f => f !== "js/app.js")) {
    vm.runInContext(read(file), context, { filename: file });
  }
  const run = code => vm.runInContext(code, context);
  if (base) {
    vm.runInContext(read("data/alimentos-base.js"), context, { filename: "data/alimentos-base.js" });
    run('applyBase(ALIMENTOS_BASE); baseState = "ok";');
  }
  return { context, run, el: id => document.getElementById(id), storage, document, location };
}

module.exports = { root, read, html, scripts, loadApp, FakeEl };
