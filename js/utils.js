/* ==========================================================
   Utilidades gerais (formatação, datas, avisos)
   ========================================================== */

const $ = id => document.getElementById(id);

// texto sem acentos e em minúsculas, para buscas
const norm = s => String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// números no formato brasileiro
const fmt = n => Math.round(n).toLocaleString("pt-BR");
const fmt1 = n => (Math.round(n * 10) / 10).toLocaleString("pt-BR");

// datas no formato "AAAA-MM-DD" (hora local)
const pad = n => String(n).padStart(2, "0");
const keyOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromKey = k => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (k, n) => { const d = fromKey(k); d.setDate(d.getDate() + n); return keyOf(d); };

// número digitado no formato brasileiro ("72,5" ou "72.5"). Vazio → null; inválido → NaN.
function parseNumBR(v) {
  const t = String(v == null ? "" : v).trim().replace(/\s+/g, "");
  if (t === "") return null;
  if (!/^-?\d+([.,]\d+)?$/.test(t)) return NaN;
  return Number(t.replace(",", "."));
}

// diferença em dias entre duas datas "AAAA-MM-DD" (b − a), contando pelo calendário local
const diasEntre = (a, b) => Math.round((fromKey(b) - fromKey(a)) / 864e5);
// "AAAA-MM-DD" do instante t (hora local), e o instante do dia k no horário h:m
const keyOfT = t => keyOf(new Date(t));
const tNoDia = (k, h, m) => { const d = fromKey(k); d.setHours(h, m, 0, 0); return d.getTime(); };
const horaDe = t => { const d = new Date(t); return pad(d.getHours()) + ":" + pad(d.getMinutes()); };

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const clone = o => JSON.parse(JSON.stringify(o));
const errMsg = e => String((e && (e.name || e.code || e.message)) || "erro desconhecido").slice(0, 60);
const isNum = v => typeof v === "number" && isFinite(v);
const r1 = x => x == null ? null : Math.round(x * 10) / 10;   // 1 casa decimal, preservando null

// hash curto e estável de um texto (FNV-1a 32 bits, em base 36)
function hash36(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}

function escapeHtml(t) {
  return String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

// aviso flutuante na parte de baixo da tela (anunciado por leitores de tela, sem tirar o foco)
function toast(msg, ms = 2600) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), ms);
}
