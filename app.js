// ================================
// CONFIG
// ================================
const API_BASE = (window.API_BASE || "").replace(/\/+$/, "");
const LS_TOKEN = "soto_token_v20";
const LS_USER = "soto_user_v20";

// Delegados (solo para nombres bonitos y selects en admin)
const USERS = [
  { username:"claudia", full_name:"Claudia Leiton", role:"delegate" },
  { username:"angela", full_name:"Angela Delgado", role:"delegate" },
  { username:"ana", full_name:"Ana María Peñaranda", role:"delegate" },
  { username:"gloria", full_name:"Gloria Yela", role:"delegate" },
  { username:"jose", full_name:"José Melo", role:"delegate" },
  { username:"yonny", full_name:"Yonny Delgado", role:"admin" }
];

const $ = (id) => document.getElementById(id);

// Estado en memoria (lo que traemos del backend)
const STATE = {
  leaders: [],   // para delegate (o admin cuando filtra)
  people: [],    // para delegate (o admin cuando filtra)
  adminLeaders: [],
  adminPeople: []
};

let SESSION = null; // {username, role, full_name}
let EDIT_LIDER_ID = null;
let EDIT_PERSONA_ID = null;

// ================================
// HELPERS
// ================================
function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
function renderCompromiso(valor){
  if(valor === "Comprometido") return `<span class="estado comprometido">Comprometido</span>`;
  if(valor === "No ubicado") return `<span class="estado no-ubicado">No ubicado</span>`;
  if(valor === "No apoya") return `<span class="estado no-apoya">No apoya</span>`;
  return escapeHtml(valor || "");
}
function getUser(username){
  return USERS.find(u => u.username === username) || null;
}
function allDelegates(){
  return USERS.filter(u => u.role === "delegate");
}
function mustHaveApi(){
  if(!API_BASE){
    throw new Error("Falta API_BASE. Abre config.js y pega la URL de Render.");
  }
}
function saveToken(token){ localStorage.setItem(LS_TOKEN, token); }
function loadToken(){ return localStorage.getItem(LS_TOKEN) || ""; }
function clearToken(){ localStorage.removeItem(LS_TOKEN); }
function saveUser(u){ localStorage.setItem(LS_USER, JSON.stringify(u)); }
function loadUser(){
  try { return JSON.parse(localStorage.getItem(LS_USER) || "null"); } catch { return null; }
}
function clearUser(){ localStorage.removeItem(LS_USER); }

async function apiFetch(path, opts={}){
  mustHaveApi();
  const token = loadToken();
  const headers = Object.assign(
    { "Content-Type": "application/json" },
    opts.headers || {}
  );
  if(token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers
  });

  const isJson = (res.headers.get("content-type") || "").includes("application/json");
  const data = isJson ? await res.json().catch(()=>null) : await res.text().catch(()=>null);

  if(!res.ok){
    const msg = (data && data.error) ? data.error : `Error ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

// ================================
// VIEWS
// ================================
function setView(v){
  $("viewLogin")?.classList.add("hidden");
  $("viewDelegate")?.classList.add("hidden");
  $("viewAdmin")?.classList.add("hidden");

  $("btnLogout")?.classList.toggle("hidden", v==="login");
  $("btnMenu")?.classList.toggle("hidden", v==="login");

  if(v==="login") $("viewLogin")?.classList.remove("hidden");
  if(v==="delegate") $("viewDelegate")?.classList.remove("hidden");
  if(v==="admin") $("viewAdmin")?.classList.remove("hidden");
}

// ================================
// DRAWER / NAV
// ================================
function openMenu(){
  $("menuDrawer")?.classList.remove("hidden");
  $("menuBackdrop")?.classList.remove("hidden");
}
function closeMenu(){
  $("menuDrawer")?.classList.add("hidden");
  $("menuBackdrop")?.classList.add("hidden");
}
$("btnMenu")?.addEventListener("click", openMenu);
$("btnCloseMenu")?.addEventListener("click", closeMenu);
$("menuBackdrop")?.addEventListener("click", closeMenu);

function setActiveNav(id){
  ["navCaptura","navReportes","navReporteGeneral"].forEach(x=>{
    const b = $(x);
    if(!b) return;
    b.classList.toggle("active", x===id);
  });
}

function showDelegateScreen(screen){
  $("screenDelegateCaptura")?.classList.add("hidden");
  $("screenDelegateReportes")?.classList.add("hidden");
  if(screen === "captura") $("screenDelegateCaptura")?.classList.remove("hidden");
  if(screen === "reportes") $("screenDelegateReportes")?.classList.remove("hidden");
}

function showAdminScreen(screen){
  $("screenAdminCaptura")?.classList.add("hidden");
  $("screenAdminReporteGeneral")?.classList.add("hidden");
  if(screen === "captura") $("screenAdminCaptura")?.classList.remove("hidden");
  if(screen === "reporteGeneral") $("screenAdminReporteGeneral")?.classList.remove("hidden");
}

function configureNavForRole(role){
  $("navCaptura")?.classList.remove("hidden");
  $("navReportes")?.classList.toggle("hidden", role !== "delegate");
  $("navReporteGeneral")?.classList.toggle("hidden", role !== "admin");

  setActiveNav("navCaptura");
  if(role === "admin") showAdminScreen("captura");
  else showDelegateScreen("captura");
}

// NAV actions
$("navCaptura")?.addEventListener("click", async () => {
  closeMenu();
  setActiveNav("navCaptura");

  try{
    if(SESSION?.role === "admin"){
      showAdminScreen("captura");
      await adminLoadTables(null); // ver todo
    }else{
      showDelegateScreen("captura");
      await delegateLoadData();
    }
  }catch(e){
    alert(e.message);
  }
});

$("navReportes")?.addEventListener("click", async () => {
  if(SESSION?.role !== "delegate") return;
  closeMenu();
  setActiveNav("navReportes");
  showDelegateScreen("reportes");
  try{ await renderDelegateReport(); }catch(e){ alert(e.message); }
});

$("navReporteGeneral")?.addEventListener("click", async () => {
  if(SESSION?.role !== "admin") return;
  closeMenu();
  setActiveNav("navReporteGeneral");
  showAdminScreen("reporteGeneral");
  try{ await renderAdminReportGeneral(); }catch(e){ alert(e.message); }
});

// ================================
// DELEGATE DATA LOAD + RENDER
// ================================
async function delegateLoadData(){
  // leaders + people del delegado (backend ya filtra por token)
  const [L, P] = await Promise.all([
    apiFetch("/leaders"),
    apiFetch("/people")
  ]);

  STATE.leaders = L.leaders || [];
  STATE.people = P.people || [];

  refreshLeaderSelect();
  renderLideresDelegate();
  renderPersonasDelegate();
}

function refreshLeaderSelect(){
  const sel = $("pLider");
  if(!sel) return;
  sel.innerHTML = `<option value="">Seleccione un líder</option>`;
  for(const l of STATE.leaders){
    const opt = document.createElement("option");
    opt.value = String(l.id);
    opt.textContent = l.nombre;
    sel.appendChild(opt);
  }
}

function countPeopleForLeader(leaderId){
  return STATE.people.filter(p => Number(p.leader_id) === Number(leaderId)).length;
}

function renderLideresDelegate(){
  const tb = $("tbodyLideres");
  if(!tb) return;
  tb.innerHTML = "";

  for(const l of STATE.leaders){
    const vinculados = countPeopleForLeader(l.id);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(l.nombre)}</td>
      <td>${escapeHtml(l.documento)}</td>
      <td>${escapeHtml(l.telefono)}</td>
      <td>${escapeHtml(l.direccion)}</td>
      <td>${escapeHtml(l.zona)}</td>
      <td>${escapeHtml(l.tipo)}</td>
      <td>${renderCompromiso(l.compromiso)}</td>
      <td>${vinculados}</td>
      <td>
        <button class="btn btnSm outline" data-act="edit-lider" data-id="${l.id}">Editar</button>
        <button class="btn btnSm danger" data-act="del-lider" data-id="${l.id}">Eliminar</button>
      </td>
    `;
    tb.appendChild(tr);
  }

  tb.querySelectorAll("button[data-act]").forEach(btn=>{
    btn.addEventListener("click", async (e)=>{
      const act = e.currentTarget.getAttribute("data-act");
      const id = Number(e.currentTarget.getAttribute("data-id"));
      if(act === "edit-lider") startEditLider(id);
      if(act === "del-lider") await deleteLider(id);
    });
  });
}

function renderPersonasDelegate(){
  const tb = $("tbodyPersonas");
  if(!tb) return;
  tb.innerHTML = "";

  const leaderMap = new Map(STATE.leaders.map(l => [Number(l.id), l.nombre]));

  for(const p of STATE.people){
    const liderNombre = leaderMap.get(Number(p.leader_id)) || "(Sin líder)";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(liderNombre)}</td>
      <td>${escapeHtml(p.nombre)}</td>
      <td>${escapeHtml(p.documento)}</td>
      <td>${escapeHtml(p.telefono)}</td>
      <td>${escapeHtml(p.direccion)}</td>
      <td>${escapeHtml(p.zona)}</td>
      <td>${p.conoce ? "Sí" : "No"}</td>
      <td>${p.compromete ? "Sí" : "No"}</td>
      <td>
        <button class="btn btnSm outline" data-act="edit-persona" data-id="${p.id}">Editar</button>
        <button class="btn btnSm danger" data-act="del-persona" data-id="${p.id}">Eliminar</button>
      </td>
    `;
    tb.appendChild(tr);
  }

  tb.querySelectorAll("button[data-act]").forEach(btn=>{
    btn.addEventListener("click", async (e)=>{
      const act = e.currentTarget.getAttribute("data-act");
      const id = Number(e.currentTarget.getAttribute("data-id"));
      if(act === "edit-persona") startEditPersona(id);
      if(act === "del-persona") await deletePersona(id);
    });
  });
}

// ================================
// EDITAR / ELIMINAR (DELEGATE)
// ================================
function startEditLider(id){
  const l = STATE.leaders.find(x => Number(x.id) === Number(id));
  if(!l) return;

  EDIT_LIDER_ID = Number(id);

  $("lNombre").value = l.nombre || "";
  $("lDocumento").value = l.documento || "";
  $("lTelefono").value = l.telefono || "";
  $("lDireccion").value = l.direccion || "";
  $("lZona").value = l.zona || "";
  $("lTipo").value = l.tipo || "A";
  $("lCompromiso").value = l.compromiso || "Comprometido";

  $("btnGuardarLider").textContent = "Actualizar líder";
  $("btnCancelarEdicionLider").classList.remove("hidden");
  $("msgLider").textContent = "✏️ Editando líder...";
}
function cancelEditLider(){
  EDIT_LIDER_ID = null;
  $("lNombre").value = "";
  $("lDocumento").value = "";
  $("lTelefono").value = "";
  $("lDireccion").value = "";
  $("lZona").value = "";
  $("lTipo").value = "A";
  $("lCompromiso").value = "Comprometido";

  $("btnGuardarLider").textContent = "Guardar líder";
  $("btnCancelarEdicionLider").classList.add("hidden");
  $("msgLider").textContent = "";
}
$("btnCancelarEdicionLider")?.addEventListener("click", cancelEditLider);

async function deleteLider(id){
  const l = STATE.leaders.find(x => Number(x.id) === Number(id));
  if(!l) return;

  const vinculados = countPeopleForLeader(id);
  const ok = confirm(`¿Eliminar el líder "${l.nombre}"?\nEsto también eliminará ${vinculados} persona(s) vinculada(s).`);
  if(!ok) return;

  await apiFetch(`/leaders/${id}`, { method:"DELETE" });

  if(EDIT_LIDER_ID === Number(id)) cancelEditLider();

  await delegateLoadData();
  await renderDelegateReport();
  $("msgLider").textContent = "🗑️ Líder eliminado.";
}

function startEditPersona(id){
  const p = STATE.people.find(x => Number(x.id) === Number(id));
  if(!p) return;

  EDIT_PERSONA_ID = Number(id);

  $("pLider").value = String(p.leader_id || "");
  $("pNombre").value = p.nombre || "";
  $("pDocumento").value = p.documento || "";
  $("pTelefono").value = p.telefono || "";
  $("pDireccion").value = p.direccion || "";
  $("pZona").value = p.zona || "";
  $("pConoce").checked = !!p.conoce;
  $("pCompromete").checked = !!p.compromete;

  $("btnGuardarPersona").textContent = "Actualizar persona";
  $("btnCancelarEdicionPersona").classList.remove("hidden");
  $("msgPersona").textContent = "✏️ Editando persona...";
}
function cancelEditPersona(){
  EDIT_PERSONA_ID = null;

  $("pLider").value = "";
  $("pNombre").value = "";
  $("pDocumento").value = "";
  $("pTelefono").value = "";
  $("pDireccion").value = "";
  $("pZona").value = "";
  $("pConoce").checked = false;
  $("pCompromete").checked = false;

  $("btnGuardarPersona").textContent = "Agregar persona";
  $("btnCancelarEdicionPersona").classList.add("hidden");
  $("msgPersona").textContent = "";
}
$("btnCancelarEdicionPersona")?.addEventListener("click", cancelEditPersona);

async function deletePersona(id){
  const p = STATE.people.find(x => Number(x.id) === Number(id));
  if(!p) return;
  const ok = confirm(`¿Eliminar la persona "${p.nombre}"?`);
  if(!ok) return;

  await apiFetch(`/people/${id}`, { method:"DELETE" });

  if(EDIT_PERSONA_ID === Number(id)) cancelEditPersona();

  await delegateLoadData();
  await renderDelegateReport();
  $("msgPersona").textContent = "🗑️ Persona eliminada.";
}

// ================================
// GUARDAR / ACTUALIZAR (DELEGATE)
// ================================
$("btnGuardarLider")?.addEventListener("click", async () => {
  $("msgLider").textContent = "";
  try{
    const payload = {
      nombre: $("lNombre").value.trim(),
      documento: $("lDocumento").value.trim(),
      telefono: $("lTelefono").value.trim(),
      direccion: $("lDireccion").value.trim(),
      zona: $("lZona").value.trim(),
      tipo: $("lTipo").value,
      compromiso: $("lCompromiso").value
    };

    if(!payload.nombre || !payload.documento){
      $("msgLider").textContent = "❌ Nombre y documento son obligatorios.";
      return;
    }

    if(EDIT_LIDER_ID){
      await apiFetch(`/leaders/${EDIT_LIDER_ID}`, { method:"PUT", body: JSON.stringify(payload) });
      $("msgLider").textContent = "✅ Líder actualizado.";
      cancelEditLider();
    }else{
      await apiFetch(`/leaders`, { method:"POST", body: JSON.stringify(payload) });
      $("msgLider").textContent = "✅ Líder guardado.";
      $("lNombre").value = "";
      $("lDocumento").value = "";
      $("lTelefono").value = "";
      $("lDireccion").value = "";
      $("lZona").value = "";
      $("lTipo").value = "A";
      $("lCompromiso").value = "Comprometido";
    }

    await delegateLoadData();
    await renderDelegateReport();
  }catch(e){
    $("msgLider").textContent = "❌ " + e.message;
  }
});

$("btnGuardarPersona")?.addEventListener("click", async () => {
  $("msgPersona").textContent = "";
  try{
    const leader_id = Number($("pLider").value);
    const payload = {
      leader_id,
      nombre: $("pNombre").value.trim(),
      documento: $("pDocumento").value.trim(),
      telefono: $("pTelefono").value.trim(),
      direccion: $("pDireccion").value.trim(),
      zona: $("pZona").value.trim(),
      conoce: $("pConoce").checked,
      compromete: $("pCompromete").checked
    };

    if(!leader_id){
      $("msgPersona").textContent = "❌ Debes seleccionar un líder.";
      return;
    }
    if(!payload.nombre || !payload.documento){
      $("msgPersona").textContent = "❌ Nombre y documento son obligatorios.";
      return;
    }

    if(EDIT_PERSONA_ID){
      await apiFetch(`/people/${EDIT_PERSONA_ID}`, { method:"PUT", body: JSON.stringify(payload) });
      $("msgPersona").textContent = "✅ Persona actualizada.";
      cancelEditPersona();
    }else{
      await apiFetch(`/people`, { method:"POST", body: JSON.stringify(payload) });
      $("msgPersona").textContent = "✅ Persona agregada.";
      $("pNombre").value = "";
      $("pDocumento").value = "";
      $("pTelefono").value = "";
      $("pDireccion").value = "";
      $("pZona").value = "";
      $("pConoce").checked = false;
      $("pCompromete").checked = false;
    }

    await delegateLoadData();
    await renderDelegateReport();
  }catch(e){
    $("msgPersona").textContent = "❌ " + e.message;
  }
});

// ================================
// REPORTES (desde backend)
// ================================
function kpi(label, value, sub=""){
  const div = document.createElement("div");
  div.className = "kpi";
  div.innerHTML = `
    <div class="label">${escapeHtml(label)}</div>
    <div class="value">${escapeHtml(value)}</div>
    <div class="sub">${escapeHtml(sub)}</div>
  `;
  return div;
}

async function renderDelegateReport(){
  const host = $("delegateReportCards");
  if(!host) return;
  host.innerHTML = "";

  const r = await apiFetch(`/reports/delegate/${encodeURIComponent(SESSION.username)}`);

  const tipo = new Map((r.tipo || []).map(x => [x.tipo, x.total]));
  const comp = new Map((r.compromiso || []).map(x => [x.compromiso, x.total]));
  const flags = r.flags || { conoce:0, compromete:0 };

  host.appendChild(kpi("Líderes", r.leaders, "Total líderes"));
  host.appendChild(kpi("Personas", r.people, "Total vinculadas"));
  host.appendChild(kpi("Tipo A", tipo.get("A") || 0, "Líderes A"));
  host.appendChild(kpi("Tipo B", tipo.get("B") || 0, "Líderes B"));
  host.appendChild(kpi("Tipo C", tipo.get("C") || 0, "Líderes C"));
  host.appendChild(kpi("Comprometido", comp.get("Comprometido") || 0, "Líderes comprometidos"));
  host.appendChild(kpi("No ubicado", comp.get("No ubicado") || 0, "Líderes no ubicados"));
  host.appendChild(kpi("No apoya", comp.get("No apoya") || 0, "Líderes no apoyan"));
  host.appendChild(kpi("Conoce líder", flags.conoce || 0, "Personas que conocen"));
  host.appendChild(kpi("Compromete votar", flags.compromete || 0, "Personas comprometidas"));
}

async function renderAdminReportGeneral(){
  const host = $("adminReportCards");
  if(!host) return;
  host.innerHTML = "";

  const r = await apiFetch(`/reports/general`);

  host.appendChild(kpi("Líderes", r.leaders, "Total general"));
  host.appendChild(kpi("Personas", r.people, "Total general"));

  // Totales por delegado (resumen)
  const leadersBy = new Map((r.leaders_by_delegate || []).map(x => [x.delegate_username, x.total]));
  const peopleBy = new Map((r.people_by_delegate || []).map(x => [x.delegate_username, x.total]));

  for(const d of allDelegates()){
    host.appendChild(kpi(
      d.full_name,
      `${leadersBy.get(d.username) || 0} / ${peopleBy.get(d.username) || 0}`,
      "Líderes / Personas"
    ));
  }
}

async function renderAdminReportDelegate(username){
  const host = $("adminReportCards");
  if(!host) return;
  host.innerHTML = "";

  const r = await apiFetch(`/reports/delegate/${encodeURIComponent(username)}`);
  const tipo = new Map((r.tipo || []).map(x => [x.tipo, x.total]));
  const comp = new Map((r.compromiso || []).map(x => [x.compromiso, x.total]));
  const flags = r.flags || { conoce:0, compromete:0 };

  const u = getUser(username);
  host.appendChild(kpi("Delegad@", u?.full_name || username, "Reporte por delegad@"));
  host.appendChild(kpi("Líderes", r.leaders, "Total"));
  host.appendChild(kpi("Personas", r.people, "Total"));
  host.appendChild(kpi("Tipo A", tipo.get("A") || 0, "Total"));
  host.appendChild(kpi("Tipo B", tipo.get("B") || 0, "Total"));
  host.appendChild(kpi("Tipo C", tipo.get("C") || 0, "Total"));
  host.appendChild(kpi("Comprometido", comp.get("Comprometido") || 0, "Total"));
  host.appendChild(kpi("No ubicado", comp.get("No ubicado") || 0, "Total"));
  host.appendChild(kpi("No apoya", comp.get("No apoya") || 0, "Total"));
  host.appendChild(kpi("Conoce líder", flags.conoce || 0, "Total"));
  host.appendChild(kpi("Compromete votar", flags.compromete || 0, "Total"));
}

// botones reportes
$("btnMiReporte")?.addEventListener("click", async ()=>{ try{ await renderDelegateReport(); }catch(e){ alert(e.message);} });
$("btnAdminReporteGeneral")?.addEventListener("click", async ()=>{ try{ await renderAdminReportGeneral(); }catch(e){ alert(e.message);} });
$("btnAdminReporteDelegado")?.addEventListener("click", async ()=>{
  try{
    const u = $("adminSelDelegadoReport").value;
    await renderAdminReportDelegate(u);
  }catch(e){ alert(e.message); }
});

// ================================
// ADMIN TABLES (carga desde backend)
// ================================
function loadAdminDelegatesSelect(){
  const sel = $("adminSelDelegado");
  const sel2 = $("adminSelDelegadoReport");
  if(sel) sel.innerHTML = "";
  if(sel2) sel2.innerHTML = "";

  for(const u of allDelegates()){
    const opt1 = document.createElement("option");
    opt1.value = u.username;
    opt1.textContent = u.full_name;
    sel?.appendChild(opt1);

    const opt2 = document.createElement("option");
    opt2.value = u.username;
    opt2.textContent = u.full_name;
    sel2?.appendChild(opt2);
  }
}

async function adminLoadTables(delegateOrNull){
  // admin: puede pedir todo o filtrar por delegate
  const q = delegateOrNull ? `?delegate=${encodeURIComponent(delegateOrNull)}` : "";
  const [L, P] = await Promise.all([
    apiFetch(`/leaders${q}`),
    apiFetch(`/people${q}`)
  ]);

  STATE.adminLeaders = L.leaders || [];
  STATE.adminPeople = P.people || [];
  renderAdminTables();
}

function renderAdminTables(){
  const tbL = $("tbodyAdminLideres");
  const tbP = $("tbodyAdminPersonas");
  if(!tbL || !tbP) return;

  tbL.innerHTML = "";
  tbP.innerHTML = "";

  const leaderIdToName = new Map(STATE.adminLeaders.map(l => [Number(l.id), l.nombre]));

  for(const l of STATE.adminLeaders){
    const delegadoName = getUser(l.delegate_username)?.full_name || l.delegate_username;
    const vinculados = STATE.adminPeople.filter(p => Number(p.leader_id) === Number(l.id)).length;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(delegadoName)}</td>
      <td>${escapeHtml(l.nombre)}</td>
      <td>${escapeHtml(l.documento)}</td>
      <td>${escapeHtml(l.telefono)}</td>
      <td>${escapeHtml(l.direccion)}</td>
      <td>${escapeHtml(l.zona)}</td>
      <td>${escapeHtml(l.tipo)}</td>
      <td>${renderCompromiso(l.compromiso)}</td>
      <td>${vinculados}</td>
    `;
    tbL.appendChild(tr);
  }

  for(const p of STATE.adminPeople){
    const delegadoName = getUser(p.delegate_username)?.full_name || p.delegate_username;
    const liderNombre = p.leader_nombre || leaderIdToName.get(Number(p.leader_id)) || "(Sin líder)";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(delegadoName)}</td>
      <td>${escapeHtml(liderNombre)}</td>
      <td>${escapeHtml(p.nombre)}</td>
      <td>${escapeHtml(p.documento)}</td>
      <td>${escapeHtml(p.telefono)}</td>
      <td>${escapeHtml(p.direccion)}</td>
      <td>${escapeHtml(p.zona)}</td>
      <td>${p.conoce ? "Sí" : "No"}</td>
      <td>${p.compromete ? "Sí" : "No"}</td>
    `;
    tbP.appendChild(tr);
  }
}

$("btnAdminVerTodo")?.addEventListener("click", async ()=>{
  try{ await adminLoadTables(null); }catch(e){ alert(e.message); }
});
$("btnAdminVerDelegado")?.addEventListener("click", async ()=>{
  try{
    const u = $("adminSelDelegado").value;
    await adminLoadTables(u);
  }catch(e){ alert(e.message); }
});

// ================================
// EXCEL EXPORT (sin librerías)
// ================================
function xlsEscape(s){
  return String(s ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
}
function buildExcelHTML(filenameTitle, sheets){
  const parts = [];
  parts.push(`<!doctype html><html><head><meta charset="utf-8"></head><body>`);
  parts.push(`<h2>${xlsEscape(filenameTitle)}</h2>`);
  for(const sh of sheets){
    parts.push(`<h3>${xlsEscape(sh.name)}</h3>`);
    parts.push(`<table border="1" cellspacing="0" cellpadding="4">`);
    parts.push(`<thead><tr>${sh.headers.map(h=>`<th>${xlsEscape(h)}</th>`).join("")}</tr></thead>`);
    parts.push(`<tbody>`);
    for(const row of sh.rows){
      parts.push(`<tr>${row.map(c=>`<td>${xlsEscape(c)}</td>`).join("")}</tr>`);
    }
    parts.push(`</tbody></table><br/>`);
  }
  parts.push(`</body></html>`);
  return parts.join("");
}
function downloadXLS(filename, html){
  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
function todayYMD(){
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}

function exportDelegadoExcelFromState(delegateUsername, leaders, people){
  const name = getUser(delegateUsername)?.full_name || delegateUsername;
  const leaderMap = new Map(leaders.map(l => [Number(l.id), l.nombre]));

  const sheetLideres = {
    name: "Líderes",
    headers: ["Delegad@", "Nombre", "Documento", "Teléfono", "Dirección/Barrio", "Zona", "Tipo", "Compromiso", "Vinculados"],
    rows: leaders.map(l => {
      const vinculados = people.filter(p => Number(p.leader_id) === Number(l.id)).length;
      return [
        name, l.nombre || "", l.documento || "", l.telefono || "", l.direccion || "",
        l.zona || "", l.tipo || "", l.compromiso || "", String(vinculados)
      ];
    })
  };

  const sheetPersonas = {
    name: "Personas vinculadas",
    headers: ["Delegad@", "Líder", "Nombre", "Documento", "Teléfono", "Dirección", "Zona", "Conoce al líder", "Compromete votar"],
    rows: people.map(p => {
      const liderNombre = p.leader_nombre || leaderMap.get(Number(p.leader_id)) || "";
      return [
        name, liderNombre, p.nombre || "", p.documento || "", p.telefono || "",
        p.direccion || "", p.zona || "", p.conoce ? "Sí" : "No", p.compromete ? "Sí" : "No"
      ];
    })
  };

  const html = buildExcelHTML(`Sotomayor - ${name} (${todayYMD()})`, [sheetLideres, sheetPersonas]);
  downloadXLS(`Sotomayor_${delegateUsername}_${todayYMD()}.xls`, html);
}

$("btnExcelDelegado")?.addEventListener("click", () => {
  exportDelegadoExcelFromState(SESSION.username, STATE.leaders, STATE.people);
});

$("btnExcelPorDelegado")?.addEventListener("click", () => {
  const du = $("adminSelDelegado")?.value;
  const leaders = STATE.adminLeaders.filter(l => l.delegate_username === du);
  const people = STATE.adminPeople.filter(p => p.delegate_username === du);
  exportDelegadoExcelFromState(du, leaders, people);
});

$("btnExcelGeneral")?.addEventListener("click", () => {
  // Exporta lo que el admin tiene cargado (si estaba en "ver todo", es todo)
  const sheets = [];

  const sheetL = {
    name: "Líderes (General)",
    headers: ["Delegad@", "Nombre", "Documento", "Teléfono", "Dirección/Barrio", "Zona", "Tipo", "Compromiso", "Vinculados"],
    rows: STATE.adminLeaders.map(l => {
      const dname = getUser(l.delegate_username)?.full_name || l.delegate_username;
      const vinculados = STATE.adminPeople.filter(p => Number(p.leader_id) === Number(l.id)).length;
      return [dname, l.nombre||"", l.documento||"", l.telefono||"", l.direccion||"", l.zona||"", l.tipo||"", l.compromiso||"", String(vinculados)];
    })
  };

  const sheetP = {
    name: "Personas (General)",
    headers: ["Delegad@", "Líder", "Nombre", "Documento", "Teléfono", "Dirección", "Zona", "Conoce al líder", "Compromete votar"],
    rows: STATE.adminPeople.map(p => {
      const dname = getUser(p.delegate_username)?.full_name || p.delegate_username;
      return [dname, p.leader_nombre||"", p.nombre||"", p.documento||"", p.telefono||"", p.direccion||"", p.zona||"", p.conoce?"Sí":"No", p.compromete?"Sí":"No"];
    })
  };

  sheets.push(sheetL, sheetP);
  const html = buildExcelHTML(`Sotomayor - GENERAL (${todayYMD()})`, sheets);
  downloadXLS(`Sotomayor_GENERAL_${todayYMD()}.xls`, html);
});

// ================================
// LOGIN / LOGOUT
// ================================
$("btnLogin")?.addEventListener("click", async () => {
  $("loginError").textContent = "";

  try{
    const username = $("loginUser").value.trim().toLowerCase();
    const password = $("loginPass").value;

    const r = await apiFetch("/auth/login", {
      method:"POST",
      body: JSON.stringify({ username, password })
    });

    saveToken(r.token);
    saveUser(r.user);

    SESSION = r.user;

    $("meLabel").textContent = `${SESSION.full_name} · ${SESSION.role}`;
    setView(SESSION.role === "admin" ? "admin" : "delegate");
    configureNavForRole(SESSION.role);

    if(SESSION.role === "admin"){
      loadAdminDelegatesSelect();
      await adminLoadTables(null);
      await renderAdminReportGeneral();
    } else {
      await delegateLoadData();
      await renderDelegateReport();
    }
  }catch(e){
    $("loginError").textContent = e.message;
  }
});

$("btnLogout")?.addEventListener("click", () => {
  SESSION = null;
  clearToken();
  clearUser();
  closeMenu();
  setView("login");
  $("meLabel").textContent = "";
});

// ================================
// BOOT
// ================================
(async function boot(){
  try{
    const saved = loadUser();
    const token = loadToken();

    if(!saved || !token){
      setView("login");
      return;
    }

    // Validamos token con /me
    SESSION = saved;
    await apiFetch("/me");

    $("meLabel").textContent = `${SESSION.full_name} · ${SESSION.role}`;
    setView(SESSION.role === "admin" ? "admin" : "delegate");
    configureNavForRole(SESSION.role);

    if(SESSION.role === "admin"){
      loadAdminDelegatesSelect();
      await adminLoadTables(null);
      await renderAdminReportGeneral();
    } else {
      await delegateLoadData();
      await renderDelegateReport();
    }
  }catch(e){
    // Si falla token, volvemos a login limpio
    SESSION = null;
    clearToken();
    clearUser();
    setView("login");
  }
})();
