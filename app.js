const USERS = [
  { username:"claudia", full_name:"Claudia Leiton", role:"delegate", pass:"1234" },
  { username:"angela", full_name:"Angela Delgado", role:"delegate", pass:"1234" },
  { username:"ana", full_name:"Ana María Peñaranda", role:"delegate", pass:"1234" },
  { username:"gloria", full_name:"Gloria Yela", role:"delegate", pass:"1234" },
  { username:"jose", full_name:"José Melo", role:"delegate", pass:"1234" },
  { username:"yonny", full_name:"Yonny Delgado", role:"admin", pass:"1234" }
];

const LS_SESSION = "soto_session_v14";
const LS_DATA = "soto_data_v14";

const $ = (id) => document.getElementById(id);

let SESSION = null;

// ✅ estados edición
let EDIT_LIDER_ID = null;
let EDIT_PERSONA_ID = null;

// ---------- utils ----------
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
function uid(prefix="id"){
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
function getUser(username){
  return USERS.find(u => u.username === username) || null;
}

// ---------- session/data ----------
function loadSession(){
  try { return JSON.parse(localStorage.getItem(LS_SESSION) || "null"); }
  catch { return null; }
}
function saveSession(s){
  if(!s) localStorage.removeItem(LS_SESSION);
  else localStorage.setItem(LS_SESSION, JSON.stringify(s));
}
function loadData(){
  try { return JSON.parse(localStorage.getItem(LS_DATA) || "{}"); }
  catch { return {}; }
}
function saveData(data){
  localStorage.setItem(LS_DATA, JSON.stringify(data));
}
function ensureDelegateStore(username){
  const data = loadData();
  if(!data[username]) data[username] = { leaders: [], people: [] };
  if(!Array.isArray(data[username].leaders)) data[username].leaders = [];
  if(!Array.isArray(data[username].people)) data[username].people = [];
  saveData(data);
  return data;
}
function delegateData(username){
  const data = loadData();
  return data[username] || { leaders: [], people: [] };
}
function allDelegatesUsernames(){
  return USERS.filter(x => x.role === "delegate").map(x => x.username);
}

// ---------- views ----------
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

// ---------- drawer ----------
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

$("navCaptura")?.addEventListener("click", () => {
  closeMenu();
  setActiveNav("navCaptura");
  if(SESSION?.role === "admin"){
    showAdminScreen("captura");
    renderAdminTables(null);
  }else{
    showDelegateScreen("captura");
    refreshLeaderSelect();
    renderLideresDelegate();
    renderPersonasDelegate();
  }
});

$("navReportes")?.addEventListener("click", () => {
  if(SESSION?.role !== "delegate") return;
  closeMenu();
  setActiveNav("navReportes");
  showDelegateScreen("reportes");
  renderDelegateReport();
});

$("navReporteGeneral")?.addEventListener("click", () => {
  if(SESSION?.role !== "admin") return;
  closeMenu();
  setActiveNav("navReporteGeneral");
  showAdminScreen("reporteGeneral");
  renderAdminReportGeneral();
});

// ---------- delegate render ----------
function refreshLeaderSelect(){
  const sel = $("pLider");
  if(!sel) return;
  sel.innerHTML = `<option value="">Seleccione un líder</option>`;
  const store = delegateData(SESSION.username);
  for(const l of store.leaders){
    const opt = document.createElement("option");
    opt.value = l.id;
    opt.textContent = l.nombre;
    sel.appendChild(opt);
  }
}

function countPeopleForLeader(delegateUsername, leaderId){
  const store = delegateData(delegateUsername);
  return store.people.filter(p => p.liderId === leaderId).length;
}

function renderLideresDelegate(){
  const tb = $("tbodyLideres");
  if(!tb) return;
  tb.innerHTML = "";
  const store = delegateData(SESSION.username);

  for(const l of store.leaders){
    const vinculados = countPeopleForLeader(SESSION.username, l.id);

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

  // delegación de eventos
  tb.querySelectorAll("button[data-act]").forEach(btn=>{
    btn.addEventListener("click", (e)=>{
      const act = e.currentTarget.getAttribute("data-act");
      const id = e.currentTarget.getAttribute("data-id");
      if(act === "edit-lider") startEditLider(id);
      if(act === "del-lider") deleteLider(id);
    });
  });
}

function renderPersonasDelegate(){
  const tb = $("tbodyPersonas");
  if(!tb) return;
  tb.innerHTML = "";
  const store = delegateData(SESSION.username);
  const mapLeader = new Map(store.leaders.map(l => [l.id, l.nombre]));

  for(const p of store.people){
    const liderNombre = mapLeader.get(p.liderId) || "(Sin líder)";
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
    btn.addEventListener("click", (e)=>{
      const act = e.currentTarget.getAttribute("data-act");
      const id = e.currentTarget.getAttribute("data-id");
      if(act === "edit-persona") startEditPersona(id);
      if(act === "del-persona") deletePersona(id);
    });
  });
}

// ---------- EDICIÓN LÍDER ----------
function startEditLider(id){
  const store = delegateData(SESSION.username);
  const l = store.leaders.find(x => x.id === id);
  if(!l) return;

  EDIT_LIDER_ID = id;

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

function deleteLider(id){
  const data = ensureDelegateStore(SESSION.username);
  const store = data[SESSION.username];
  const l = store.leaders.find(x => x.id === id);
  if(!l) return;

  const vinculados = store.people.filter(p => p.liderId === id).length;
  const ok = confirm(`¿Eliminar el líder "${l.nombre}"?\nEsto también eliminará ${vinculados} persona(s) vinculada(s).`);
  if(!ok) return;

  // si estaba editando ese líder, cancelar
  if(EDIT_LIDER_ID === id) cancelEditLider();

  store.leaders = store.leaders.filter(x => x.id !== id);
  store.people = store.people.filter(p => p.liderId !== id);

  saveData(data);

  refreshLeaderSelect();
  renderLideresDelegate();
  renderPersonasDelegate();
  renderDelegateReport();

  $("msgLider").textContent = "🗑️ Líder eliminado.";
}

// ---------- EDICIÓN PERSONA ----------
function startEditPersona(id){
  const store = delegateData(SESSION.username);
  const p = store.people.find(x => x.id === id);
  if(!p) return;

  EDIT_PERSONA_ID = id;

  $("pLider").value = p.liderId || "";
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

function deletePersona(id){
  const data = ensureDelegateStore(SESSION.username);
  const store = data[SESSION.username];
  const p = store.people.find(x => x.id === id);
  if(!p) return;

  const ok = confirm(`¿Eliminar la persona "${p.nombre}"?`);
  if(!ok) return;

  if(EDIT_PERSONA_ID === id) cancelEditPersona();

  store.people = store.people.filter(x => x.id !== id);
  saveData(data);

  renderLideresDelegate();
  renderPersonasDelegate();
  renderDelegateReport();

  $("msgPersona").textContent = "🗑️ Persona eliminada.";
}

// ---------- reports ----------
function buildReportForDelegate(username){
  const store = delegateData(username);
  const leaders = store.leaders || [];
  const people = store.people || [];

  const tipoA = leaders.filter(l => l.tipo === "A").length;
  const tipoB = leaders.filter(l => l.tipo === "B").length;
  const tipoC = leaders.filter(l => l.tipo === "C").length;

  const compOK = leaders.filter(l => l.compromiso === "Comprometido").length;
  const compNU = leaders.filter(l => l.compromiso === "No ubicado").length;
  const compNA = leaders.filter(l => l.compromiso === "No apoya").length;

  const conoce = people.filter(p => p.conoce).length;
  const compromete = people.filter(p => p.compromete).length;

  return { leadersTotal: leaders.length, peopleTotal: people.length, tipoA, tipoB, tipoC, compOK, compNU, compNA, conoce, compromete };
}

function buildReportGeneral(){
  const totals = { leadersTotal:0, peopleTotal:0, tipoA:0, tipoB:0, tipoC:0, compOK:0, compNU:0, compNA:0, conoce:0, compromete:0 };
  for(const d of allDelegatesUsernames()){
    const r = buildReportForDelegate(d);
    Object.keys(totals).forEach(k => totals[k] += (r[k] || 0));
  }
  return totals;
}

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

function renderDelegateReport(){
  const host = $("delegateReportCards");
  if(!host) return;
  host.innerHTML = "";
  const r = buildReportForDelegate(SESSION.username);

  host.appendChild(kpi("Líderes", r.leadersTotal, "Total líderes"));
  host.appendChild(kpi("Personas", r.peopleTotal, "Total vinculadas"));
  host.appendChild(kpi("Tipo A", r.tipoA, "Líderes A"));
  host.appendChild(kpi("Tipo B", r.tipoB, "Líderes B"));
  host.appendChild(kpi("Tipo C", r.tipoC, "Líderes C"));
  host.appendChild(kpi("Comprometido", r.compOK, "Líderes comprometidos"));
  host.appendChild(kpi("No ubicado", r.compNU, "Líderes no ubicados"));
  host.appendChild(kpi("No apoya", r.compNA, "Líderes no apoyan"));
  host.appendChild(kpi("Conoce líder", r.conoce, "Personas que conocen"));
  host.appendChild(kpi("Compromete votar", r.compromete, "Personas comprometidas"));
}

function renderAdminReportGeneral(){
  const host = $("adminReportCards");
  if(!host) return;
  host.innerHTML = "";
  const r = buildReportGeneral();

  host.appendChild(kpi("Líderes", r.leadersTotal, "Total general"));
  host.appendChild(kpi("Personas", r.peopleTotal, "Total general"));
  host.appendChild(kpi("Tipo A", r.tipoA, "General"));
  host.appendChild(kpi("Tipo B", r.tipoB, "General"));
  host.appendChild(kpi("Tipo C", r.tipoC, "General"));
  host.appendChild(kpi("Comprometido", r.compOK, "General"));
  host.appendChild(kpi("No ubicado", r.compNU, "General"));
  host.appendChild(kpi("No apoya", r.compNA, "General"));
  host.appendChild(kpi("Conoce líder", r.conoce, "General"));
  host.appendChild(kpi("Compromete votar", r.compromete, "General"));
}

function renderAdminReportDelegate(username){
  const host = $("adminReportCards");
  if(!host) return;
  host.innerHTML = "";

  const u = getUser(username);
  const name = u?.full_name || username;
  const r = buildReportForDelegate(username);

  host.appendChild(kpi("Delegad@", name, "Reporte por delegad@"));
  host.appendChild(kpi("Líderes", r.leadersTotal, "Total"));
  host.appendChild(kpi("Personas", r.peopleTotal, "Total"));
  host.appendChild(kpi("Tipo A", r.tipoA, "Total"));
  host.appendChild(kpi("Tipo B", r.tipoB, "Total"));
  host.appendChild(kpi("Tipo C", r.tipoC, "Total"));
  host.appendChild(kpi("Comprometido", r.compOK, "Total"));
  host.appendChild(kpi("No ubicado", r.compNU, "Total"));
  host.appendChild(kpi("No apoya", r.compNA, "Total"));
  host.appendChild(kpi("Conoce líder", r.conoce, "Total"));
  host.appendChild(kpi("Compromete votar", r.compromete, "Total"));
}

// ---------- admin tables (solo visual) ----------
function loadAdminDelegatesSelect(){
  const sel = $("adminSelDelegado");
  const sel2 = $("adminSelDelegadoReport");
  if(sel) sel.innerHTML = "";
  if(sel2) sel2.innerHTML = "";

  for(const u of USERS.filter(x => x.role === "delegate")){
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

function renderAdminTables(filterUsername = null){
  const tbL = $("tbodyAdminLideres");
  const tbP = $("tbodyAdminPersonas");
  if(!tbL || !tbP) return;

  tbL.innerHTML = "";
  tbP.innerHTML = "";

  const data = loadData();
  const delegates = filterUsername ? [filterUsername] : allDelegatesUsernames();

  for(const du of delegates){
    const user = getUser(du);
    const delegateName = user?.full_name || du;
    const store = data[du] || { leaders: [], people: [] };
    const leaderMap = new Map((store.leaders||[]).map(l => [l.id, l.nombre]));

    for(const l of store.leaders || []){
      const vinculados = (store.people || []).filter(p => p.liderId === l.id).length;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(delegateName)}</td>
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

    for(const p of store.people || []){
      const liderNombre = leaderMap.get(p.liderId) || "(Sin líder)";
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(delegateName)}</td>
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
}

// =====================================================
// EXCEL EXPORT (sin librerías)
// =====================================================
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
function exportDelegadoExcel(username){
  const u = getUser(username);
  const name = u?.full_name || username;
  const store = delegateData(username);

  const leaders = store.leaders || [];
  const people = store.people || [];
  const leaderMap = new Map(leaders.map(l => [l.id, l.nombre]));

  const sheetLideres = {
    name: "Líderes",
    headers: ["Delegad@", "Nombre", "Documento", "Teléfono", "Dirección/Barrio", "Zona", "Tipo", "Compromiso", "Vinculados"],
    rows: leaders.map(l => {
      const vinculados = people.filter(p => p.liderId === l.id).length;
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
      const liderNombre = leaderMap.get(p.liderId) || "";
      return [
        name, liderNombre, p.nombre || "", p.documento || "", p.telefono || "",
        p.direccion || "", p.zona || "", p.conoce ? "Sí" : "No", p.compromete ? "Sí" : "No"
      ];
    })
  };

  const html = buildExcelHTML(`Sotomayor - ${name} (${todayYMD()})`, [sheetLideres, sheetPersonas]);
  downloadXLS(`Sotomayor_${username}_${todayYMD()}.xls`, html);
}
function exportGeneralExcel(){
  const delegates = allDelegatesUsernames();
  const allLeaders = [];
  const allPeople = [];

  for(const du of delegates){
    const u = getUser(du);
    const name = u?.full_name || du;
    const store = delegateData(du);
    const leaders = store.leaders || [];
    const people = store.people || [];
    const leaderMap = new Map(leaders.map(l => [l.id, l.nombre]));

    for(const l of leaders){
      const vinculados = people.filter(p => p.liderId === l.id).length;
      allLeaders.push([name, l.nombre || "", l.documento || "", l.telefono || "", l.direccion || "", l.zona || "", l.tipo || "", l.compromiso || "", String(vinculados)]);
    }
    for(const p of people){
      allPeople.push([name, leaderMap.get(p.liderId) || "", p.nombre || "", p.documento || "", p.telefono || "", p.direccion || "", p.zona || "", p.conoce ? "Sí" : "No", p.compromete ? "Sí" : "No"]);
    }
  }

  const sheetL = {
    name: "Líderes (General)",
    headers: ["Delegad@", "Nombre", "Documento", "Teléfono", "Dirección/Barrio", "Zona", "Tipo", "Compromiso", "Vinculados"],
    rows: allLeaders
  };
  const sheetP = {
    name: "Personas (General)",
    headers: ["Delegad@", "Líder", "Nombre", "Documento", "Teléfono", "Dirección", "Zona", "Conoce al líder", "Compromete votar"],
    rows: allPeople
  };

  const html = buildExcelHTML(`Sotomayor - GENERAL (${todayYMD()})`, [sheetL, sheetP]);
  downloadXLS(`Sotomayor_GENERAL_${todayYMD()}.xls`, html);
}

// ---------- Excel buttons ----------
$("btnExcelDelegado")?.addEventListener("click", () => exportDelegadoExcel(SESSION.username));
$("btnExcelGeneral")?.addEventListener("click", () => exportGeneralExcel());
$("btnExcelPorDelegado")?.addEventListener("click", () => {
  const du = $("adminSelDelegado")?.value;
  if(!du) return;
  exportDelegadoExcel(du);
});

// ---------- login/logout ----------
$("btnLogin").addEventListener("click", () => {
  $("loginError").textContent = "";
  const username = $("loginUser").value.trim().toLowerCase();
  const password = $("loginPass").value;

  const u = getUser(username);
  if(!u || u.pass !== password){
    $("loginError").textContent = "Credenciales inválidas.";
    return;
  }

  SESSION = { username: u.username, role: u.role };
  saveSession(SESSION);

  $("meLabel").textContent = `${u.full_name} · ${u.role}`;
  setView(u.role === "admin" ? "admin" : "delegate");
  configureNavForRole(u.role);

  if(u.role === "admin"){
    loadAdminDelegatesSelect();
    renderAdminTables(null);
    renderAdminReportGeneral();
  }else{
    ensureDelegateStore(u.username);
    refreshLeaderSelect();
    renderLideresDelegate();
    renderPersonasDelegate();
    renderDelegateReport();
  }
});

$("btnLogout").addEventListener("click", () => {
  SESSION = null;
  saveSession(null);
  $("meLabel").textContent = "";
  closeMenu();
  setView("login");
});

// ---------- GUARDAR/ACTUALIZAR LÍDER ----------
$("btnGuardarLider")?.addEventListener("click", () => {
  $("msgLider").textContent = "";

  const nombre = $("lNombre").value.trim();
  const documento = $("lDocumento").value.trim();
  const telefono = $("lTelefono").value.trim();
  const direccion = $("lDireccion").value.trim();
  const zona = $("lZona").value.trim();
  const tipo = $("lTipo").value;
  const compromiso = $("lCompromiso").value;

  if(!nombre || !documento){
    $("msgLider").textContent = "❌ Nombre y documento son obligatorios.";
    return;
  }

  const data = ensureDelegateStore(SESSION.username);
  const store = data[SESSION.username];

  // Validar duplicado por documento (permitir si es el mismo que estoy editando)
  const existeDoc = store.leaders.some(l => (l.documento || "").trim() === documento && l.id !== EDIT_LIDER_ID);
  if(existeDoc){
    $("msgLider").textContent = "❌ Ya existe un líder con ese documento (en este delegado).";
    return;
  }

  if(EDIT_LIDER_ID){
    const l = store.leaders.find(x => x.id === EDIT_LIDER_ID);
    if(!l) { cancelEditLider(); return; }

    l.nombre = nombre;
    l.documento = documento;
    l.telefono = telefono;
    l.direccion = direccion;
    l.zona = zona;
    l.tipo = tipo;
    l.compromiso = compromiso;
    l.updated_at = new Date().toISOString();

    saveData(data);

    $("msgLider").textContent = "✅ Líder actualizado.";
    cancelEditLider();
  } else {
    store.leaders.push({
      id: uid("lider"),
      nombre, documento, telefono, direccion, zona,
      tipo, compromiso,
      created_at: new Date().toISOString()
    });
    saveData(data);

    $("msgLider").textContent = "✅ Líder guardado.";
    $("lNombre").value = "";
    $("lDocumento").value = "";
    $("lTelefono").value = "";
    $("lDireccion").value = "";
    $("lZona").value = "";
    $("lTipo").value = "A";
    $("lCompromiso").value = "Comprometido";
  }

  refreshLeaderSelect();
  renderLideresDelegate();
  renderPersonasDelegate();
  renderDelegateReport();
});

// ---------- GUARDAR/ACTUALIZAR PERSONA ----------
$("btnGuardarPersona")?.addEventListener("click", () => {
  $("msgPersona").textContent = "";

  const liderId = $("pLider").value;
  const nombre = $("pNombre").value.trim();
  const documento = $("pDocumento").value.trim();
  const telefono = $("pTelefono").value.trim();
  const direccion = $("pDireccion").value.trim();
  const zona = $("pZona").value.trim();
  const conoce = $("pConoce").checked;
  const compromete = $("pCompromete").checked;

  if(!liderId){
    $("msgPersona").textContent = "❌ Debes seleccionar un líder.";
    return;
  }
  if(!nombre || !documento){
    $("msgPersona").textContent = "❌ Nombre y documento son obligatorios.";
    return;
  }

  const data = ensureDelegateStore(SESSION.username);
  const store = data[SESSION.username];

  const existeDoc = store.people.some(p => (p.documento || "").trim() === documento && p.id !== EDIT_PERSONA_ID);
  if(existeDoc){
    $("msgPersona").textContent = "❌ Ya existe una persona con ese documento (en este delegado).";
    return;
  }

  if(EDIT_PERSONA_ID){
    const p = store.people.find(x => x.id === EDIT_PERSONA_ID);
    if(!p) { cancelEditPersona(); return; }

    p.liderId = liderId;
    p.nombre = nombre;
    p.documento = documento;
    p.telefono = telefono;
    p.direccion = direccion;
    p.zona = zona;
    p.conoce = conoce;
    p.compromete = compromete;
    p.updated_at = new Date().toISOString();

    saveData(data);

    $("msgPersona").textContent = "✅ Persona actualizada.";
    cancelEditPersona();
  } else {
    store.people.push({
      id: uid("persona"),
      liderId, nombre, documento, telefono, direccion, zona,
      conoce, compromete,
      created_at: new Date().toISOString()
    });

    saveData(data);

    $("msgPersona").textContent = "✅ Persona agregada.";
    $("pNombre").value = "";
    $("pDocumento").value = "";
    $("pTelefono").value = "";
    $("pDireccion").value = "";
    $("pZona").value = "";
    $("pConoce").checked = false;
    $("pCompromete").checked = false;
  }

  refreshLeaderSelect();
  renderLideresDelegate();
  renderPersonasDelegate();
  renderDelegateReport();
});

// Admin filtros
$("btnAdminVerTodo")?.addEventListener("click", () => renderAdminTables(null));
$("btnAdminVerDelegado")?.addEventListener("click", () => {
  const u = $("adminSelDelegado").value;
  renderAdminTables(u);
});

// Report buttons
$("btnMiReporte")?.addEventListener("click", renderDelegateReport);
$("btnAdminReporteGeneral")?.addEventListener("click", renderAdminReportGeneral);
$("btnAdminReporteDelegado")?.addEventListener("click", () => {
  const u = $("adminSelDelegadoReport").value;
  renderAdminReportDelegate(u);
});

// ===== BOOT =====
(function boot(){
  SESSION = loadSession();

  if(!SESSION){
    setView("login");
    return;
  }

  const u = getUser(SESSION.username);
  if(!u){
    saveSession(null);
    SESSION = null;
    setView("login");
    return;
  }

  $("meLabel").textContent = `${u.full_name} · ${u.role}`;
  setView(u.role === "admin" ? "admin" : "delegate");
  configureNavForRole(u.role);

  if(u.role === "admin"){
    loadAdminDelegatesSelect();
    renderAdminTables(null);
    renderAdminReportGeneral();
  }else{
    ensureDelegateStore(u.username);
    refreshLeaderSelect();
    renderLideresDelegate();
    renderPersonasDelegate();
    renderDelegateReport();
  }
})();
