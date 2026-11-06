/* ==========================================================
   Armazenamento dos dados
   1) Sempre: no próprio navegador (localStorage), automático.
   2) Opcional: num arquivo .json numa pasta do computador, gravado
      a cada mudança (Chrome e Edge no computador).
      Em outros navegadores, use "Baixar cópia de segurança".
   ========================================================== */

const LSKEY = "diario-calorias:v1";
const LS_OK = (() => {
  try { localStorage.setItem("dc-teste", "1"); localStorage.removeItem("dc-teste"); return true; }
  catch (e) { return false; }
})();
const FS_OK = typeof window.showSaveFilePicker === "function";
const IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const STANDALONE = (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
const WHERE = (IOS || STANDALONE) ? "no celular" : "no navegador";

let fileHandle = null;
let fileState = "none";   // none | ok | permission | error

/* ---------- Formato dos dados ---------- */
// versao 2: alimentos cadastrados no schema da base (data/alimentos_unificados.json)
// versao 3: histórico de peso e medidas (medidas)
// versao 4: metas versionadas (metas); profile.meta migra para metas
// versao 5: preferências (copo, período do Analytics), nome e objetivo "ganhar" no perfil
const DATA_VERSAO = 5;
function snapshot() {
  return { app: "diario-calorias", versao: DATA_VERSAO, savedAt, profile, preferencias: prefs, days, medidas, metas };
}
// backup do app (profile/days) ou arquivo de "Exportar alimentos cadastrados" (alimentos)
function validData(d) {
  return !!d && typeof d === "object" && !Array.isArray(d) && !!(d.profile || d.days || Array.isArray(d.alimentos) || Array.isArray(d.medidas) || Array.isArray(d.metas) || d.preferencias);
}
// campos simples guardados em cada dia, além das listas
const DAY_EXTRA = ["tdee", "tmb", "pesoRef", "pesoMetodo", "completo"];
function cleanDays(src) {
  const out = {};
  Object.keys(src || {}).forEach(k => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return;
    const d = src[k] || {};
    out[k] = { foods: Array.isArray(d.foods) ? d.foods : [], ex: Array.isArray(d.ex) ? d.ex : [] };
    DAY_EXTRA.forEach(x => { if (d[x] !== undefined) out[k][x] = d[x]; });
    if (Array.isArray(d.agua)) out[k].agua = cleanAgua(d.agua);
  });
  return out;
}
// preferências: valores fora da faixa voltam ao padrão (nunca apagam o resto dos dados)
function cleanPrefs(src) {
  const p = src && typeof src === "object" ? src : {};
  const out = clone(DEFAULT_PREFS);
  const copo = Number(p.copo_ml);
  if (isNum(copo) && copo >= COPO_FAIXA[0] && copo <= COPO_FAIXA[1]) out.copo_ml = Math.round(copo);
  if (p.copo_tipo === "outra") out.copo_tipo = "outra";
  if (["hoje", "7d", "30d", "90d", "custom"].includes(p.periodo)) out.periodo = p.periodo;
  const isK = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));
  if (isK(p.periodo_ini)) out.periodo_ini = p.periodo_ini;
  if (isK(p.periodo_fim)) out.periodo_fim = p.periodo_fim;
  return out;
}

// campo numérico do perfil: número válido ou null (nunca NaN)
const numOuNull = v => (v == null || v === "" ? null : isNum(Number(v)) ? Number(v) : null);

// campos do perfil adicionados nas versões 1.2 e 1.3 (perfis antigos ganham o padrão)
function cleanProfileExtras() {
  profile.nome = typeof profile.nome === "string" ? profile.nome.trim().slice(0, 60) : "";
  profile.peso = numOuNull(profile.peso);
  profile.altura = numOuNull(profile.altura);
  profile.idade = numOuNull(profile.idade);
  if (profile.sexo !== "M" && profile.sexo !== "F") profile.sexo = "";
  profile.fator = [1.2, 1.3, 1.4].includes(Number(profile.fator)) ? Number(profile.fator) : 1.2;
  profile.condicoes = Array.isArray(profile.condicoes) ? profile.condicoes.filter(k => CONDICOES.some(c => c.k === k)) : [];
  if (idadeEm(profile.nascimento, TODAY) == null) profile.nascimento = "";
  if (!["perder", "manter", "ganhar"].includes(profile.objetivo)) profile.objetivo = "manter";
  const t = profile.treino && typeof profile.treino === "object" ? profile.treino : {};
  profile.treino = {
    tipo: ["nenhum", "aerobico", "forca", "misto"].includes(t.tipo) ? t.tipo : "nenhum",
    dias: Number.isInteger(t.dias) && t.dias >= 0 && t.dias <= 7 ? t.dias : 0,
    min: isNum(t.min) && t.min >= 0 && t.min <= 600 ? t.min : 0,
    intensidade: ["leve", "moderada", "vigorosa"].includes(t.intensidade) ? t.intensidade : "moderada"
  };
}
function replaceWith(d) {
  profile = Object.assign(clone(DEFAULT_PROFILE), d.profile || {});
  profile.customFoods = cleanCustomFoods(profile.customFoods);
  cleanProfileExtras();
  days = cleanDays(d.days);
  medidas = cleanMedidas(d.medidas);
  metas = cleanMetas(d.metas);
  prefs = cleanPrefs(d.preferencias);
  migrarMetaAntiga();
  savedAt = d.savedAt || null;
}
// junta sem perder nada dos dois lados (usado ao abrir um arquivo)
function mergeIn(d) {
  if (d.profile) {
    const keep = profile.customFoods || [];
    profile = Object.assign(clone(DEFAULT_PROFILE), profile, d.profile);
    // os seus primeiro; do arquivo, só os que ainda não existem (pelo nome)
    profile.customFoods = cleanCustomFoods(keep.concat(Array.isArray(d.profile.customFoods) ? d.profile.customFoods : []));
    cleanProfileExtras();
  }
  if (Array.isArray(d.alimentos)) profile.customFoods = cleanCustomFoods((profile.customFoods || []).concat(d.alimentos));
  if (Array.isArray(d.medidas)) medidas = cleanMedidas(medidas.concat(d.medidas));
  if (Array.isArray(d.metas)) metas = cleanMetas(metas.concat(d.metas));
  // preferências do arquivo só entram se as daqui ainda estão no padrão
  if (d.preferencias && !Object.keys(DEFAULT_PREFS).some(k => prefs[k] !== DEFAULT_PREFS[k])) prefs = cleanPrefs(d.preferencias);
  const inc = cleanDays(d.days);
  Object.keys(inc).forEach(k => {
    const mine = days[k] || { foods: [], ex: [] };
    const ids = new Set(mine.foods.concat(mine.ex).map(x => x.id));
    inc[k].foods.forEach(f => { if (!ids.has(f.id)) mine.foods.push(f); });
    inc[k].ex.forEach(e => { if (!ids.has(e.id)) mine.ex.push(e); });
    DAY_EXTRA.forEach(x => { if (mine[x] == null && inc[k][x] != null) mine[x] = inc[k][x]; });
    if (inc[k].agua) mine.agua = cleanAgua((mine.agua || []).concat(inc[k].agua));
    days[k] = mine;
  });
  migrarMetaAntiga();
}

/* ---------- Salvar ---------- */
let fileTimer = null, writing = false, writeAgain = false;
let saveError = null;      // última falha ao gravar no navegador (null = gravou)
let lerBloqueado = false;  // dados salvos ilegíveis e sem cópia: o app não grava por cima

// Grava no navegador (e no arquivo, se houver). Devolve false se não conseguiu gravar.
function persist() {
  savedAt = new Date().toISOString();
  let ok = true;
  if (lerBloqueado) ok = false;
  else if (LS_OK) {
    try { localStorage.setItem(LSKEY, JSON.stringify(snapshot())); saveError = null; }
    catch (e) {
      ok = false;
      saveError = errMsg(e);
      toast("Não consegui salvar no navegador (" + saveError + "). Baixe uma cópia de segurança.", 5000);
    }
  }
  clearTimeout(fileTimer);
  fileTimer = setTimeout(writeFile, 300);
  setStatus();
  return ok;
}

async function writeFile() {
  if (!fileHandle || fileState !== "ok") return;
  if (writing) { writeAgain = true; return; }
  writing = true;
  try {
    const w = await fileHandle.createWritable();
    await w.write(JSON.stringify(snapshot(), null, 1));
    await w.close();
  } catch (e) {
    console.error(e);
    fileState = (e && e.name === "NotAllowedError") ? "permission" : "error";
    toast("Não consegui gravar no arquivo (" + errMsg(e) + "). Os dados continuam salvos no navegador.");
  }
  writing = false;
  setStatus();
  if (writeAgain) { writeAgain = false; writeFile(); }
}

function saveDay(k = cur) {
  const d = days[k];
  if (!d) return;
  if (k === TODAY || d.tdee == null) {
    // guarda o cálculo da época: o dia passado não muda quando o perfil mudar
    // (sem dados suficientes no Perfil fica null, e o dia é calculado quando houver)
    const ref = pesoReferencia(k);
    const g = dayTdee(k), b = dayTmb(k);
    d.tdee = g == null ? null : Math.round(g);
    d.tmb = b == null ? null : Math.round(b);
    d.pesoRef = r1(ref.peso);
    d.pesoMetodo = ref.metodo;
  }
  persist();
}

let profTimer;
function saveProfile() {
  clearTimeout(profTimer);
  profTimer = setTimeout(persist, 500);
}

// Guarda uma cópia do texto salvo que não pôde ser lido, antes de qualquer gravação nova.
// Sem espaço para a cópia, o app não grava por cima dos dados (lerBloqueado) e avisa.
function guardarIlegivel(raw, motivo) {
  const k = LSKEY + ":ilegivel:" + new Date().toISOString();
  try { localStorage.setItem(k, raw); }
  catch (_) { lerBloqueado = true; }
  console.warn("Dados salvos ilegíveis (" + motivo + ")");
  toast(lerBloqueado
    ? "Não consegui ler os dados salvos. Para não perdê-los, o app não vai gravar por cima: baixe uma cópia de segurança pelo menu do topo."
    : "Não consegui ler os dados salvos (" + motivo + "). Guardei uma cópia deles neste navegador; o app começa vazio.", 7000);
  return k;
}

// carrega o que estiver salvo no navegador; devolve true se havia dados
function loadSaved() {
  if (!LS_OK) return false;
  let raw = null;
  try { raw = localStorage.getItem(LSKEY); }
  catch (e) { console.error(e); toast("Não consegui ler os dados salvos (" + errMsg(e) + ")."); return false; }
  if (!raw) return false;
  let d;
  try { d = JSON.parse(raw); }
  catch (e) { guardarIlegivel(raw, errMsg(e)); return true; }
  if (!validData(d)) { guardarIlegivel(raw, "formato desconhecido"); return true; }
  try { replaceWith(d); }
  catch (e) { guardarIlegivel(raw, errMsg(e)); replaceWith({}); }
  return true;
}

/* ---------- IndexedDB: lembra do arquivo usado da última vez ---------- */
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open("diario-calorias", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("kv");
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbGet(k) {
  const db = await idb();
  return new Promise((res, rej) => {
    const q = db.transaction("kv").objectStore("kv").get(k);
    q.onsuccess = () => res(q.result);
    q.onerror = () => rej(q.error);
  });
}
async function idbSet(k, v) {
  const db = await idb();
  return new Promise((res, rej) => {
    const t = db.transaction("kv", "readwrite");
    t.objectStore("kv").put(v, k);
    t.oncomplete = () => res();
    t.onerror = () => rej(t.error);
  });
}

/* ---------- Arquivo de dados no computador ---------- */
const PICK_TYPES = [{ description: "Dados do Diário de Calorias", accept: { "application/json": [".json"] } }];

async function readHandle(h) {
  const txt = await (await h.getFile()).text();
  return txt.trim() ? JSON.parse(txt) : null;
}

async function createFile() {
  try {
    const h = await window.showSaveFilePicker({ suggestedName: "diario-calorias.json", types: PICK_TYPES });
    fileHandle = h;
    fileState = "ok";
    try { await idbSet("arquivo", h); } catch (_) { /* sem IndexedDB: só não lembra na próxima vez */ }
    persist();
    await writeFile();
    toast("Arquivo criado: " + h.name + ". Tudo o que você registrar é gravado nele.", 3600);
  } catch (e) {
    if (e && e.name !== "AbortError") toast("Não consegui criar o arquivo (" + errMsg(e) + ").");
  }
}

async function openFile() {
  if (!FS_OK) { $("fileIn").value = ""; $("fileIn").click(); return; }
  try {
    const [h] = await window.showOpenFilePicker({ types: PICK_TYPES, multiple: false });
    const data = await readHandle(h);
    if (data && !validData(data)) { toast("Esse arquivo não é do Diário de Calorias."); return; }
    if (data) mergeIn(data);
    // Uma lista de alimentos é importada, sem virar o arquivo de gravação do diário.
    if (data && Array.isArray(data.alimentos) && !data.profile && !data.days) {
      persist(); renderProfile(); renderAll();
      toast("Alimentos do arquivo carregados.");
      return;
    }
    // pede permissão de gravação para continuar salvando nesse arquivo
    const perm = h.requestPermission ? await h.requestPermission({ mode: "readwrite" }) : "granted";
    if (perm === "granted") {
      fileHandle = h;
      fileState = "ok";
      try { await idbSet("arquivo", h); } catch (_) { /* idem */ }
    }
    persist(); renderProfile(); renderAll();
    toast(perm === "granted"
      ? "Arquivo aberto. Os registros agora são gravados em " + h.name + "."
      : "Dados carregados (sem permissão para gravar no arquivo).", 3600);
  } catch (e) {
    if (e && e.name !== "AbortError") toast("Não consegui abrir o arquivo (" + errMsg(e) + ").");
  }
}

// alternativa para navegadores sem acesso direto a arquivos (Safari, Firefox, celulares)
async function openFromInput() {
  const f = $("fileIn").files[0];
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    if (!validData(data)) { toast("Esse arquivo não é do Diário de Calorias."); return; }
    mergeIn(data); persist(); renderProfile(); renderAll();
    toast("Dados do arquivo carregados.");
  } catch (e) {
    toast("Não consegui ler o arquivo (" + errMsg(e) + ").");
  }
}

async function reconnect() {
  if (!fileHandle) return;
  try {
    const perm = await fileHandle.requestPermission({ mode: "readwrite" });
    if (perm !== "granted") { toast("Sem permissão, os dados ficam só no navegador."); return; }
    await syncFromFile();
    toast("Arquivo reconectado: " + fileHandle.name + ".");
  } catch (e) {
    fileState = "error"; setStatus();
    toast("Não consegui reconectar (" + errMsg(e) + ").");
  }
}

// ao reabrir: o que for mais recente (navegador ou arquivo) vale
async function syncFromFile() {
  const data = await readHandle(fileHandle);
  fileState = "ok";
  if (data && validData(data) && (!savedAt || (data.savedAt && data.savedAt > savedAt))) {
    replaceWith(data);
    if (LS_OK) { try { localStorage.setItem(LSKEY, JSON.stringify(snapshot())); } catch (_) { /* segue só com o arquivo */ } }
    renderProfile(); renderAll(); setStatus();
  } else {
    setStatus();
    await writeFile();
  }
}

// lembra do arquivo de dados usado da última vez (Chrome/Edge)
async function restoreFileHandle() {
  if (!FS_OK || !window.indexedDB) return;
  try {
    const h = await idbGet("arquivo");
    if (!h) return;
    fileHandle = h;
    const perm = await h.queryPermission({ mode: "readwrite" });
    if (perm === "granted") await syncFromFile();
    else { fileState = "permission"; setStatus(); }
  } catch (e) {
    console.error(e);
  }
}

/* ---------- Baixar arquivos .json ---------- */
// no iPhone abre o menu Compartilhar (dá para escolher "Salvar em Arquivos"); nos outros, baixa
async function saveJsonFile(name, data, okMsg) {
  const txt = JSON.stringify(data, null, 1);
  if (IOS && navigator.canShare) {
    try {
      const file = new File([txt], name, { type: "application/json" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "Diário de Calorias" });
        return;
      }
    } catch (e) {
      if (e && e.name === "AbortError") return;
      console.error(e);
    }
  }
  const blob = new Blob([txt], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast(okMsg + " O arquivo está na pasta de downloads.", 3600);
}

function downloadBackup() {
  return saveJsonFile(`diario-calorias-${TODAY}.json`, snapshot(), "Cópia de segurança baixada.");
}

function exportCustomFoods() {
  const list = profile.customFoods || [];
  if (!list.length) { toast("Você ainda não cadastrou nenhum alimento."); return; }
  saveJsonFile(`alimentos-usuario-${TODAY}.json`, {
    versao_schema: "1.0.0",
    descricao: "Alimentos cadastrados no Diário de Calorias, no formato de data/alimentos_unificados.json. Para sugerir a inclusão na base do app, envie este arquivo numa issue do repositório.",
    total_alimentos: list.length,
    alimentos: list
  }, `${list.length} alimento(s) exportado(s).`);
}

/* ---------- Indicador "Salvo…" e menu ---------- */
function setStatus() {
  const s = $("status");
  s.classList.remove("warn", "ok");
  let txt, info;
  if (fileState === "ok") {
    txt = "Salvo no computador"; s.classList.add("ok");
    info = `Gravando em <b>${escapeHtml(fileHandle.name)}</b> a cada registro, e também no navegador.`;
  } else if (fileState === "permission") {
    txt = "Reconectar arquivo"; s.classList.add("warn");
    info = `Os dados estão salvos no navegador. Para continuar gravando em <b>${escapeHtml(fileHandle.name)}</b>, toque em "Reconectar o arquivo".`;
  } else if (fileState === "error") {
    txt = "Erro no arquivo"; s.classList.add("warn");
    info = "Não consegui gravar no arquivo. Os dados continuam salvos no navegador. Crie ou abra o arquivo de novo.";
  } else if (lerBloqueado) {
    txt = "Dados não lidos"; s.classList.add("warn");
    info = "Os dados salvos neste navegador não puderam ser lidos. Para não perdê-los, o app não grava por cima. Baixe uma cópia de segurança antes de continuar.";
  } else if (saveError) {
    txt = "Erro ao salvar"; s.classList.add("warn");
    info = "A última gravação no navegador falhou (" + escapeHtml(saveError) + "). Libere espaço no aparelho ou baixe uma cópia de segurança agora.";
  } else if (LS_OK) {
    txt = "Salvo " + WHERE;
    if (IOS && !STANDALONE) {
      info = "Os dados ficam salvos neste Safari. Para usar como app, toque em Compartilhar › <b>Adicionar à Tela de Início</b> e use sempre pelo ícone (o app e o Safari guardam dados separados).";
    } else if (IOS) {
      info = "Os dados ficam salvos no celular, dentro deste app. De vez em quando, use \"Baixar cópia de segurança\" e escolha <b>Salvar em Arquivos</b>.";
    } else if (FS_OK) {
      info = "Os dados ficam salvos neste navegador, neste aparelho. Para ter também um arquivo numa pasta sua, crie um arquivo de dados.";
    } else {
      info = "Os dados ficam salvos neste navegador, neste aparelho. Este navegador não grava direto numa pasta: use \"Baixar cópia de segurança\" de vez em quando (no Chrome ou Edge do computador dá para gravar automático).";
    }
  } else {
    txt = "Não está salvando"; s.classList.add("warn");
    info = "Este navegador bloqueou o armazenamento (janela anônima?). Baixe uma cópia de segurança antes de fechar.";
  }
  s.textContent = txt + " ▾";
  $("mInfo").innerHTML = info;
  $("mReconnect").classList.toggle("hide", fileState !== "permission");
  $("mNew").classList.toggle("hide", !FS_OK);
}

const closeMenu = () => { $("modeMenu").classList.remove("open"); $("status").setAttribute("aria-expanded", "false"); };

function initStorageMenu() {
  $("status").onclick = e => {
    e.stopPropagation();
    if (fileState === "permission") { closeMenu(); reconnect(); return; }
    const aberto = $("modeMenu").classList.toggle("open");
    $("status").setAttribute("aria-expanded", String(aberto));
  };
  $("modeMenu").onclick = e => e.stopPropagation();
  document.addEventListener("click", closeMenu);
  document.addEventListener("keydown", e => { if (e.key === "Escape" && $("modeMenu").classList.contains("open")) { closeMenu(); $("status").focus(); } });
  $("mReconnect").onclick = () => { closeMenu(); reconnect(); };
  $("mNew").onclick = () => { closeMenu(); createFile(); };
  $("mOpen").onclick = () => { closeMenu(); openFile(); };
  $("mDown").onclick = () => { closeMenu(); downloadBackup(); };
  $("mExport").onclick = () => { closeMenu(); exportCustomFoods(); };
  $("fileIn").addEventListener("change", openFromInput);
}
