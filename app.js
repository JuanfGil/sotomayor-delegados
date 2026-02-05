const USERS = [
  { username:"claudia", full_name:"Claudia Leiton", role:"delegate", pass:"1234" },
  { username:"angela", full_name:"Angela Delgado", role:"delegate", pass:"1234" },
  { username:"ana", full_name:"Ana María Peñaranda", role:"delegate", pass:"1234" },
  { username:"gloria", full_name:"Gloria Yela", role:"delegate", pass:"1234" },
  { username:"jose", full_name:"José Melo", role:"delegate", pass:"1234" },
  { username:"yonny", full_name:"Yonny Delgado", role:"admin", pass:"1234" }
];

const LS_SESSION = "soto_session_v7";
const LS_DATA = "soto_data_v7";

const $ = (id) => document.getElementById(id);

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

function setView(v){
  $("viewLogin")?.classList.add("hidden");
  $("viewDelegate")?.classList.add("hidden");
  $("viewAdmin")?.classList.add("hidden");
  $("btnLogout")?.classList.toggle("hidden", v==="login");

  if(v==="login") $("viewLogin")?.classList.remove("hidden");
  if(v==="delegate") $("viewDelegate")?.classList.remove("hidden");
  if(v==="admin") $("viewAdmin")?.classList.remove("hidden");
}

// ---------- Data helpers ----------
function delegateData(username){
  const data = loadData();
  return data[username] || { leaders: [], people: [] };
}

function allDelegatesUsernames(){
  return USERS.filter(x => x.role === "delegate").map(x => x.username);
}

// ---------- Render delegate tables ----------
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
    `;
    tb.appendChild(tr);
  }
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
    `;
    tb.appendChild(tr);
  }
}

function renderDelegateAll(){
  refreshLeaderSelect();
  renderLideresDelegate();
  renderPersonasDelegate();
  renderDelegateReport();
}

// ---------- Report builders ----------
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

  return {
    leadersTotal: leaders.length,
    peopleTotal: people.length,
    tipoA, tipoB, tipoC,
    compOK, compNU, compNA,
    conoce, compromete
  };
}

function buildReportGeneral(){
  const delegates = allDelegatesUsernames();
  const totals = {
    leadersTotal: 0, peopleTotal: 0,
    tipoA: 0, tipoB: 0, tipoC: 0,
    compOK: 0, compNU: 0, compNA: 0,
    conoce: 0, compromete: 0
  };

  for(const d of delegates){
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

  host.appendChild(kpi("Líderes", r.leadersTotal, "Total líderes registrados"));
  host.appendChild(kpi("Personas", r.peopleTotal, "Total personas vinculadas"));
  host.appendChild(kpi("Tipo A", r.tipoA, "Líderes tipo A"));
  host.appendChild(kpi("Tipo B", r.tipoB, "Líderes tipo B"));
  host.appendChild(kpi("Tipo C", r.tipoC, "Líderes tipo C"));

  // compromiso (se ve el color en el label del sub)
  host.appendChild(kpi("Comprometido", r.compOK, "Líderes comprometidos"));
  host.appendChild(kpi("No ubicado", r.compNU, "Líderes no ubicados"));
  host.appendChild(kpi("No apoya", r.compNA, "Líderes no apoyan"));
  host.appendChild(kpi("Conoce al líder", r.conoce, "Personas que conocen al líder"));
  host.appendChild(kpi("Compromete votar", r.compromete, "Personas que se comprometen a votar"));
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
  host.appendChild(kpi("Conoce al líder", r.conoce, "General"));
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
  host.appendChild(kpi("Líderes", r.leadersTotal, "Total del delegad@"));
  host.appendChild(kpi("Personas", r.peopleTotal, "Total del delegad@"));
  host.appendChild(kpi("Tipo A", r.tipoA, "Del delegad@"));
  host.appendChild(kpi("Tipo B", r.tipoB, "Del delegad@"));
  host.appendChild(kpi("Tipo C", r.tipoC, "Del delegad@"));
  host.appendChild(kpi("Comprometido", r.compOK, "Del delegad@"));
  host.appendChild(kpi("No ubicado", r.compNU, "Del delegad@"));
  host.appendChild(kpi("No apoya", r.compNA, "Del delegad@"));
  host.appendChild(kpi("Conoce al líder", r.conoce, "Del delegad@"));
  host.appendChild(kpi("Compromete votar", r.compromete, "Del delegad@"));
}

// ---------- Admin tables ----------
function loadAdminDelegatesSelect(){
  const sel = $("adminSelDelegado");
  if(!sel) return;
  sel.innerHTML = "";
  for(const u of USERS.filter(x => x.role === "delegate")){
    const opt = document.createElement("option");
    opt.value = u.username;
    opt.textContent = u.full_name;
    sel.appendChild(opt);
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

// ===========================
// Actions
// ===========================
let SESSION = loadSession();

// Login
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

  if(u.role === "admin"){
    setView("admin");
    loadAdminDelegatesSelect();
    renderAdminTables(null);
    renderAdminReportGeneral();
  }else{
    ensureDelegateStore(u.username);
    setView("delegate");
    renderDelegateAll();
  }
});

$("btnLogout").addEventListener("click", () => {
  SESSION = null;
  saveSession(null);
  $("meLabel").textContent = "";
  setView("login");
});

// Delegate: guardar líder
$("btnGuardarLider")?.addEventListener("click", () => {
  $("msgLider").textContent = "";

  const nombre = $("lNombre").value.trim();
  const documento = $("lDocumento").value.trim();
  const telefono = $("lTelefono").value.trim();
  const direccion = $("lDireccion").value.trim();
  const zona = $("lZona").value.trim();
  const tipo = $("lTipo").value; // A/B/C
  const compromiso = $("lCompromiso").value; // Comprometido/No ubicado/No apoya

  if(!nombre || !documento){
    $("msgLider").textContent = "❌ Nombre y documento son obligatorios.";
    return;
  }

  const data = ensureDelegateStore(SESSION.username);
  const store = data[SESSION.username];

  if(store.leaders.some(l => (l.documento || "").trim() === documento)){
    $("msgLider").textContent = "❌ Ya existe un líder con ese documento (en este delegado).";
    return;
  }

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

  renderDelegateAll();
});

// Delegate: guardar persona
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

  if(store.people.some(p => (p.documento || "").trim() === documento)){
    $("msgPersona").textContent = "❌ Ya existe una persona con ese documento (en este delegado).";
    return;
  }

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

  renderDelegateAll();
});

// Delegate report refresh
$("btnMiReporte")?.addEventListener("click", renderDelegateReport);

// Admin: report buttons
$("btnAdminReporteGeneral")?.addEventListener("click", renderAdminReportGeneral);
$("btnAdminReporteDelegado")?.addEventListener("click", () => {
  const u = $("adminSelDelegado").value;
  renderAdminReportDelegate(u);
});

// Admin tables filters
$("btnAdminVerTodo")?.addEventListener("click", () => renderAdminTables(null));
$("btnAdminVerDelegado")?.addEventListener("click", () => {
  const u = $("adminSelDelegado").value;
  renderAdminTables(u);
});

// ===========================
// BOOT
// ===========================
(function boot(){
  if(!SESSION){
    setView("login");
    return;
  }

  const u = getUser(SESSION.username);
  if(!u){
    saveSession(null);
    setView("login");
    return;
  }

  $("meLabel").textContent = `${u.full_name} · ${u.role}`;

  if(u.role === "admin"){
    setView("admin");
    loadAdminDelegatesSelect();
    renderAdminTables(null);
    renderAdminReportGeneral();
  }else{
    ensureDelegateStore(u.username);
    setView("delegate");
    renderDelegateAll();
  }
})();
