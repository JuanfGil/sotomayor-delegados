// app.js (frontend-only / LocalStorage)

const USERS = [
  { username: "claudia", full_name: "Claudia Leiton", role: "delegate", pass: "1234" },
  { username: "angela", full_name: "Angela Delgado", role: "delegate", pass: "1234" },
  { username: "ana", full_name: "Ana María Peñaranda", role: "delegate", pass: "1234" },
  { username: "gloria", full_name: "Gloria Yela", role: "delegate", pass: "1234" },
  { username: "jose", full_name: "José Melo", role: "delegate", pass: "1234" },
  { username: "yonny", full_name: "Yonny Delgado", role: "admin", pass: "1234" },
];

const LS_SESSION = "soto_session_v1";
const LS_RECORDS = "soto_records_v1"; // { username: [records...] }

const $ = (id) => document.getElementById(id);

const viewLogin = $("viewLogin");
const viewDelegate = $("viewDelegate");
const viewAdmin = $("viewAdmin");
const btnLogout = $("btnLogout");
const meLabel = $("meLabel");

let SESSION = loadSession();

function loadSession() {
  try { return JSON.parse(localStorage.getItem(LS_SESSION) || "null"); }
  catch { return null; }
}

function saveSession(s) {
  SESSION = s;
  if (!s) localStorage.removeItem(LS_SESSION);
  else localStorage.setItem(LS_SESSION, JSON.stringify(s));
}

function loadAllRecords() {
  try { return JSON.parse(localStorage.getItem(LS_RECORDS) || "{}"); }
  catch { return {}; }
}

function saveAllRecords(obj) {
  localStorage.setItem(LS_RECORDS, JSON.stringify(obj));
}

function setView(which) {
  viewLogin.classList.add("hidden");
  viewDelegate.classList.add("hidden");
  viewAdmin.classList.add("hidden");

  if (which === "login") viewLogin.classList.remove("hidden");
  if (which === "delegate") viewDelegate.classList.remove("hidden");
  if (which === "admin") viewAdmin.classList.remove("hidden");

  btnLogout.classList.toggle("hidden", which === "login");
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getUser(username) {
  return USERS.find(u => u.username === username) || null;
}

function getMyRecords(username) {
  const all = loadAllRecords();
  return Array.isArray(all[username]) ? all[username] : [];
}

function setMyRecords(username, list) {
  const all = loadAllRecords();
  all[username] = list;
  saveAllRecords(all);
}

function renderMine() {
  const tb = $("tbodyMine");
  tb.innerHTML = "";
  const list = getMyRecords(SESSION.username);

  for (const r of list.slice().sort((a,b) => (b.created_at || "").localeCompare(a.created_at || ""))) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(r.fecha)}</td>
      <td>${escapeHtml(r.lugar)}</td>
      <td>${escapeHtml(r.titulo)}</td>
      <td>${escapeHtml(r.descripcion)}</td>
      <td>${escapeHtml(r.contacto)}</td>
      <td>${escapeHtml(r.telefono)}</td>
    `;
    tb.appendChild(tr);
  }
}

function renderAdmin(list) {
  const tb = $("tbodyAdmin");
  tb.innerHTML = "";

  for (const r of list.slice().sort((a,b) => (b.created_at || "").localeCompare(a.created_at || ""))) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(r.delegate_name)}</td>
      <td>${escapeHtml(r.fecha)}</td>
      <td>${escapeHtml(r.lugar)}</td>
      <td>${escapeHtml(r.titulo)}</td>
      <td>${escapeHtml(r.descripcion)}</td>
      <td>${escapeHtml(r.contacto)}</td>
      <td>${escapeHtml(r.telefono)}</td>
    `;
    tb.appendChild(tr);
  }
}

function buildSummary(records) {
  const total = records.length;
  if (total === 0) return { total: 0, primera: "-", ultima: "-" };

  const fechas = records.map(r => r.fecha).filter(Boolean).sort();
  return {
    total,
    primera: fechas[0] || "-",
    ultima: fechas[fechas.length - 1] || "-"
  };
}

function formatSummary(title, sum, extraLines = []) {
  let txt = `${title}\nTotal registros: ${sum.total}\nPrimera fecha: ${sum.primera}\nÚltima fecha: ${sum.ultima}`;
  if (extraLines.length) txt += `\n\n${extraLines.join("\n")}`;
  return txt;
}

// ---------- Boot ----------
function boot() {
  if (!SESSION) {
    setView("login");
    meLabel.textContent = "";
    return;
  }

  const u = getUser(SESSION.username);
  if (!u) {
    saveSession(null);
    setView("login");
    meLabel.textContent = "";
    return;
  }

  meLabel.textContent = `${u.full_name} · ${u.role}`;

  if (u.role === "admin") {
    setView("admin");
    loadDelegatesSelect();
    showAllAdmin();
  } else {
    setView("delegate");
    $("fFecha").value = todayISO();
    renderMine();
  }
}

// ---------- Login ----------
$("btnLogin").addEventListener("click", () => {
  $("loginError").textContent = "";

  const username = $("loginUser").value.trim().toLowerCase();
  const password = $("loginPass").value;

  const u = getUser(username);
  if (!u || password !== u.pass) {
    $("loginError").textContent = "Credenciales inválidas (mock).";
    return;
  }

  saveSession({ username: u.username });
  $("loginUser").value = "";
  $("loginPass").value = "";
  boot();
});

btnLogout.addEventListener("click", () => {
  saveSession(null);
  setView("login");
  meLabel.textContent = "";
});

// ---------- Delegate actions ----------
$("btnGuardar")?.addEventListener("click", () => {
  $("saveMsg").textContent = "";

  const payload = {
    fecha: $("fFecha").value || todayISO(),
    lugar: $("fLugar").value.trim(),
    contacto: $("fContacto").value.trim(),
    telefono: $("fTelefono").value.trim(),
    titulo: $("fTitulo").value.trim(),
    descripcion: $("fDescripcion").value.trim(),
    created_at: new Date().toISOString()
  };

  if (!payload.titulo || !payload.descripcion) {
    $("saveMsg").textContent = "❌ Título y descripción son obligatorios.";
    return;
  }

  const list = getMyRecords(SESSION.username);
  list.push(payload);
  setMyRecords(SESSION.username, list);

  $("saveMsg").textContent = "✅ Guardado.";
  $("fTitulo").value = "";
  $("fDescripcion").value = "";
  renderMine();
});

$("btnRefrescarMine")?.addEventListener("click", renderMine);

$("btnMiReporte")?.addEventListener("click", () => {
  const box = $("delegateReport");
  const list = getMyRecords(SESSION.username);
  const sum = buildSummary(list);
  box.classList.remove("hidden");
  box.textContent = formatSummary("MI REPORTE", sum);
});

$("btnLimpiarMisDatos")?.addEventListener("click", () => {
  const ok = confirm("¿Seguro que quieres borrar SOLO tus registros?");
  if (!ok) return;
  setMyRecords(SESSION.username, []);
  $("delegateReport").classList.add("hidden");
  renderMine();
});

// ---------- Admin actions ----------
function loadDelegatesSelect() {
  const sel = $("selDelegate");
  sel.innerHTML = "";

  const delegates = USERS.filter(u => u.role === "delegate");
  for (const d of delegates) {
    const opt = document.createElement("option");
    opt.value = d.username;
    opt.textContent = d.full_name;
    sel.appendChild(opt);
  }
}

function getAllRecordsAdmin() {
  const all = loadAllRecords();
  const out = [];

  for (const u of USERS.filter(x => x.role === "delegate")) {
    const list = Array.isArray(all[u.username]) ? all[u.username] : [];
    for (const r of list) {
      out.push({ ...r, delegate_username: u.username, delegate_name: u.full_name });
    }
  }
  return out;
}

function showAllAdmin() {
  const list = getAllRecordsAdmin();
  renderAdmin(list);
}

function showByDelegateAdmin(username) {
  const u = getUser(username);
  const list = getMyRecords(username).map(r => ({
    ...r,
    delegate_username: username,
    delegate_name: u?.full_name || username
  }));
  renderAdmin(list);
}

$("btnVerTodos")?.addEventListener("click", () => {
  $("adminReport").classList.add("hidden");
  showAllAdmin();
});

$("btnVerPorDelegado")?.addEventListener("click", () => {
  $("adminReport").classList.add("hidden");
  const username = $("selDelegate").value;
  showByDelegateAdmin(username);
});

$("btnReporteGeneral")?.addEventListener("click", () => {
  const box = $("adminReport");
  const all = getAllRecordsAdmin();
  const sum = buildSummary(all);

  // breakdown
  const lines = [];
  for (const d of USERS.filter(u => u.role === "delegate")) {
    const s = buildSummary(getMyRecords(d.username));
    lines.push(`- ${d.full_name}: ${s.total}`);
  }

  box.classList.remove("hidden");
  box.textContent = formatSummary("REPORTE GENERAL", sum, ["POR DELEGAD@:", ...lines]);
});

$("btnReporteDelegado")?.addEventListener("click", () => {
  const username = $("selDelegate").value;
  const u = getUser(username);
  const box = $("adminReport");

  const list = getMyRecords(username);
  const sum = buildSummary(list);
  box.classList.remove("hidden");
  box.textContent = formatSummary(`REPORTE DE: ${u?.full_name || username}`, sum);
});

$("btnLimpiarTodo")?.addEventListener("click", () => {
  const ok = confirm("¿Seguro que quieres borrar TODO (de todos los delegad@s)?");
  if (!ok) return;

  localStorage.removeItem(LS_RECORDS);
  $("adminReport").classList.add("hidden");
  showAllAdmin();
});

// Start
boot();
