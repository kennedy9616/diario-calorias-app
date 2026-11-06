// Driver mínimo do Chrome DevTools Protocol (sem dependências; Node 22+ tem WebSocket).
const { spawn } = require("node:child_process");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
// Chrome: variável CHROME ou os caminhos mais comuns
const CHROME = process.env.CHROME || [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"
].find(p => fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));

// perfil temporário e vazio: o teste nunca toca nos dados do seu navegador
async function launch({ port = 9333, profile } = {}) {
  if (!CHROME) throw new Error("Chrome não encontrado. Defina a variável CHROME com o caminho do executável.");
  const dir = profile || fs.mkdtempSync(path.join(os.tmpdir(), "diario-e2e-"));
  const proc = spawn(CHROME, ["--headless=new", "--remote-debugging-port=" + port, "--user-data-dir=" + dir,
    "--no-first-run", "--no-default-browser-check", "--disable-gpu", "--force-dark-mode", "--blink-settings=preferredColorScheme=0", "about:blank"], { stdio: "ignore" });
  let ver;
  for (let i = 0; i < 60; i++) {
    try { ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); break; } catch (_) { await sleep(250); }
  }
  if (!ver) throw new Error("Chrome não abriu");
  const ws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pend = new Map(); const handlers = [];
  ws.onmessage = m => {
    const d = JSON.parse(m.data);
    if (d.id && pend.has(d.id)) { const p = pend.get(d.id); pend.delete(d.id); d.error ? p.j(new Error(JSON.stringify(d.error))) : p.r(d.result); }
    else handlers.forEach(h => h(d));
  };
  const send = (method, params = {}, sessionId) => new Promise((r, j) => { const i = ++id; pend.set(i, { r, j }); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const s = (m, p) => send(m, p, sessionId);
  const logs = [];
  handlers.push(d => {
    if (d.sessionId !== sessionId) return;
    if (d.method === "Runtime.consoleAPICalled" && ["error", "warning", "assert"].includes(d.params.type))
      logs.push(d.params.type + ": " + d.params.args.map(a => a.value || a.description || "").join(" "));
    if (d.method === "Runtime.exceptionThrown") logs.push("exception: " + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text));
    if (d.method === "Log.entryAdded" && d.params.entry.level === "error") logs.push("log: " + d.params.entry.text + " " + (d.params.entry.url || ""));
    if (d.method === "Network.loadingFailed" && !d.params.canceled) logs.push("netfail: " + d.params.errorText + " " + (reqs.get(d.params.requestId) || ""));
    if (d.method === "Network.requestWillBeSent") reqs.set(d.params.requestId, d.params.request.url);
    if (d.method === "Network.responseReceived" && d.params.response.status >= 400) logs.push("http " + d.params.response.status + " " + d.params.response.url);
  });
  const reqs = new Map();
  await s("Page.enable"); await s("Runtime.enable"); await s("Log.enable"); await s("Network.enable");
  await s("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "dark" }] });

  const api = {
    logs, send: s,
    async viewport(width, height = 800, mobile = width < 700) {
      await s("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: mobile ? 2 : 1, mobile });
      await s("Emulation.setTouchEmulationEnabled", { enabled: mobile });
    },
    async media(features) { await s("Emulation.setEmulatedMedia", { features }); },
    async goto(url, wait = 900) {
      const done = new Promise(r => { const h = d => { if (d.sessionId === sessionId && d.method === "Page.loadEventFired") { handlers.splice(handlers.indexOf(h), 1); r(); } }; handlers.push(h); });
      await s("Page.navigate", { url }); await done; await sleep(wait);
    },
    async reload(wait = 900) {
      const done = new Promise(r => { const h = d => { if (d.sessionId === sessionId && d.method === "Page.loadEventFired") { handlers.splice(handlers.indexOf(h), 1); r(); } }; handlers.push(h); });
      await s("Page.reload", { ignoreCache: false }); await done; await sleep(wait);
    },
    async eval(expr) {
      const r = await s("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true, userGesture: true });
      if (r.exceptionDetails) throw new Error("eval: " + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
      return r.result.value;
    },
    async shot(file, full = true) {
      let clip;
      if (full) {
        const m = await s("Page.getLayoutMetrics");
        clip = { x: 0, y: 0, width: m.cssContentSize.width, height: Math.min(m.cssContentSize.height, 6000), scale: 1 };
      }
      const r = await s("Page.captureScreenshot", { format: "png", captureBeyondViewport: full, ...(clip ? { clip } : {}) });
      fs.writeFileSync(file, Buffer.from(r.data, "base64"));
    },
    async key(key, code = key, keyCode = 0) {
      for (const type of ["keyDown", "keyUp"]) await s("Input.dispatchKeyEvent", { type, key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode });
    },
    async tap(sel) {
      const box = await api.eval(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; e.scrollIntoView({block:"center"}); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
      if (!box) throw new Error("sem elemento " + sel);
      for (const type of ["mousePressed", "mouseReleased"]) await s("Input.dispatchMouseEvent", { type, x: box.x, y: box.y, button: "left", clickCount: 1 });
      await sleep(60);
    },
    async close() { try { ws.close(); } catch (_) {} proc.kill(); await sleep(300); }
  };
  return api;
}
module.exports = { launch, sleep };
