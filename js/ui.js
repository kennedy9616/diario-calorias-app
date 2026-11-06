/* ==========================================================
   Componentes de interface compartilhados
   - ícones (traço, 24×24, mesma espessura em todo o app)
   - erros junto ao campo (aria-invalid + aria-describedby)
   - janela de edição de registros (<dialog> nativo: foco preso,
     Esc fecha, foco volta para o botão que abriu)
   ========================================================== */

const svgIcon = d => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${d}</svg>`;
const ICON_EDIT = svgIcon('<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>');
const ICON_DEL = svgIcon('<path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13"/>');

// pede confirmação antes de excluir (sem janela disponível, segue)
function confirmar(msg) {
  try { return typeof window.confirm === "function" ? window.confirm(msg) : true; } catch (_) { return true; }
}

/* ---------- Erros de campo ---------- */
function mostrarErroCampo(errId, msg, campoId) {
  const box = $(errId);
  box.textContent = msg;
  if (campoId) {
    const f = $(campoId);
    if (f) {
      f.setAttribute("aria-invalid", "true");
      f.setAttribute("aria-describedby", errId);
      f.focus();
    }
    box.dataset.campo = campoId;
  }
}
function limparErroCampo(errId) {
  const box = $(errId);
  box.textContent = "";
  const c = box.dataset.campo;
  if (c && $(c)) { $(c).removeAttribute("aria-invalid"); $(c).removeAttribute("aria-describedby"); }
  box.dataset.campo = "";
}

/* ---------- Janela de edição ---------- */
// campos: [{ id, rotulo, tipo: "decimal"|"inteiro"|"date"|"time"|"select", valor, opcoes: [[v, rótulo]], max, ajuda }]
// salvar(valores) devolve { ok: true } ou { erro, campo }
// retorno: id do elemento que recebe o foco se o botão de origem sumir (lista redesenhada)
function abrirEdicao({ titulo, campos, salvar, excluir, retorno }) {
  const dlg = $("editDlg");
  const volta = document.activeElement;
  $("editTitulo").textContent = titulo;
  const corpo = $("editCampos");
  corpo.innerHTML = "";
  campos.forEach(c => {
    const wrap = document.createElement("div");
    wrap.className = "field";
    const lab = document.createElement("label");
    lab.htmlFor = "ed-" + c.id;
    lab.textContent = c.rotulo;
    let inp;
    if (c.tipo === "select") {
      inp = document.createElement("select");
      (c.opcoes || []).forEach(([v, t]) => {
        const o = document.createElement("option");
        o.value = v; o.textContent = t;
        inp.appendChild(o);
      });
    } else {
      inp = document.createElement("input");
      if (c.tipo === "date" || c.tipo === "time") inp.type = c.tipo;
      else { inp.type = "text"; inp.inputMode = c.tipo === "inteiro" ? "numeric" : "decimal"; inp.autocomplete = "off"; }
      if (c.max) inp.max = c.max;
    }
    inp.id = "ed-" + c.id;
    inp.value = c.valor == null ? "" : String(c.valor);
    wrap.appendChild(lab);
    wrap.appendChild(inp);
    if (c.ajuda) {
      const h = document.createElement("p");
      h.className = "hint";
      h.textContent = c.ajuda;
      wrap.appendChild(h);
    }
    corpo.appendChild(wrap);
  });
  $("editErro").textContent = "";
  $("editExcluir").classList.toggle("hide", !excluir);

  const fechar = () => {
    if (dlg.open && dlg.close) dlg.close(); else dlg.removeAttribute("open");
    if (volta && volta.focus && document.contains && document.contains(volta)) volta.focus();
    else if (retorno && $(retorno)) $(retorno).focus();
  };
  $("editForm").onsubmit = e => {
    e.preventDefault();
    const valores = {};
    campos.forEach(c => { valores[c.id] = $("ed-" + c.id).value; });
    let r;
    try { r = salvar(valores) || { ok: true }; }
    catch (err) { console.error(err); r = { erro: "Não consegui salvar (" + errMsg(err) + ")." }; }
    if (r.ok) { fechar(); return; }
    $("editErro").textContent = r.erro || "Confira os valores.";
    const f = r.campo && $("ed-" + r.campo);
    if (f) { f.setAttribute("aria-invalid", "true"); f.focus(); }
  };
  $("editCancelar").onclick = fechar;
  $("editExcluir").onclick = () => { if (excluir && excluir() !== false) fechar(); };
  if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", "");
  const first = corpo.querySelector("input,select");
  if (first && first.focus) first.focus();
}
