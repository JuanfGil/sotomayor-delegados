// ===========================
// CONFIG (mock users)
// ===========================
const USERS = [
  { username:"claudia", full_name:"Claudia Leiton", role:"delegate", pass:"1234" },
  { username:"angela", full_name:"Angela Delgado", role:"delegate", pass:"1234" },
  { username:"ana", full_name:"Ana María Peñaranda", role:"delegate", pass:"1234" },
  { username:"gloria", full_name:"Gloria Yela", role:"delegate", pass:"1234" },
  { username:"jose", full_name:"José Melo", role:"delegate", pass:"1234" },
  { username:"yonny", full_name:"Yonny Delgado", role:"admin", pass:"1234" }
];

const LS_SESSION = "soto_session_v6";
const LS_DATA = "soto_data_v6";
// {
//   claudia: { leaders: [...], people: [...] },
//   ...
// }

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
  if(valor === "Comprometido"){
    return `<span class="estado comprometido">Comprometido</span>`;
  }
  if(valor === "No ubicado"){
    return `<span class="estado no-ubicado">No ubicado</span>`;
  }
  if(valor === "No apoya"){
    return `<span class="estado no-apoya">No apoya</span>`;
  }
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
  $("viewLogin").classList.add("hidden");
  $("viewDelegate").classList.add("hidden");
  $("viewAdmin").classList.add("hidden");
  $("btnLogout").classList.toggle("hidden", v==="login");

  if(v==="login") $("viewLogin").classList.remove("hidden");
  if(v==="delegate") $("viewDelegate").classList.remove("hidden");
  if(v==="admin") $("viewAdmin").classList.remove("hidden");
}

// ===========================
// Delegate rendering
// ===========================
function delegateData(username){
  const data = loadData();
  return data[username] || { leaders: [], people: [] };
}

function refreshLeaderSelect(){
  const sel = $("pLider");
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
}

// ===========================
// Admin rendering
// ===========================
function loadAdminDelegatesSelect(){
  const sel = $("adminSelDelegado");
  sel.innerHTML = "";
  for(const u of USERS.filter(x => x.role === "delegate")){
    const opt = document.createElement("option");
    opt.value = u.username;
    opt.textContent = u.full_name;
    sel.appendChild(opt);
  }
}

function allDelegatesUsernames(){
  return USERS.filter(x => x.role === "delegate").map(x => x.username);
}

function renderAdminTables(filterUsername = null){
  const tbL = $("tbodyAdminLideres");
  const tbP = $("tbodyAdminPersonas");
  tbL.innerHTML = "";
  tbP.innerHTML = "";

  const data = loadData();
  const delegates = filterUsername ? [filterUsername] : allDelegatesUsernames();

  for(const du of delegates){
    const user = getUser(du);
    const delegateName = user?.full_name || du;
    const store = data[du] || { leaders: [], people: [] };
    const leaderMap = new Map(store.leaders.map(l => [l.id, l.nombre]));

    for(const l of store.leaders){
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

// Guardar líder
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
    nombre,
    documento,
    telefono,
    direccion,
    zona,
    tipo,
    compromiso,
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

// Guardar persona vinculada
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
    liderId,
    nombre,
    documento,
    telefono,
    direccion,
    zona,
    conoce,
    compromete,
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

// Admin filtros
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
  }else{
    ensureDelegateStore(u.username);
    setView("delegate");
    renderDelegateAll();
  }
})();
