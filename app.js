// ===== CONFIG =====
const USERS = [
  { username:"claudia", full_name:"Claudia Leiton", role:"delegate", pass:"1234" },
  { username:"angela", full_name:"Angela Delgado", role:"delegate", pass:"1234" },
  { username:"ana", full_name:"Ana María Peñaranda", role:"delegate", pass:"1234" },
  { username:"gloria", full_name:"Gloria Yela", role:"delegate", pass:"1234" },
  { username:"jose", full_name:"José Melo", role:"delegate", pass:"1234" },
  { username:"yonny", full_name:"Yonny Delgado", role:"admin", pass:"1234" }
];

const LS_SESSION = "soto_session";
const LS_RECORDS = "soto_records"; // { username: [records...] }

// ===== HELPERS =====
const $ = (id) => document.getElementById(id);

function todayISO(){
  const d = new Date();
  return d.toISOString().slice(0,10);
}
function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;");
}
function getUser(u){ return USERS.find(x=>x.username===u) || null; }

function loadSession(){
  try{ return JSON.parse(localStorage.getItem(LS_SESSION)); }catch{ return null; }
}
function saveSession(s){
  if(!s) localStorage.removeItem(LS_SESSION);
  else localStorage.setItem(LS_SESSION, JSON.stringify(s));
}
function loadAllRecords(){
  try{ return JSON.parse(localStorage.getItem(LS_RECORDS)) || {}; }catch{ return {}; }
}
function saveAllRecords(o){
  localStorage.setItem(LS_RECORDS, JSON.stringify(o));
}
function getMyRecords(username){
  const all = loadAllRecords();
  return Array.isArray(all[username]) ? all[username] : [];
}
function setMyRecords(username, list){
  const all = loadAllRecords();
  all[username] = list;
  saveAllRecords(all);
}

// ===== VIEWS =====
function setView(v){
  $("viewLogin").classList.add("hidden");
  $("viewDelegate").classList.add("hidden");
  $("viewAdmin").classList.add("hidden");
  $("btnLogout").classList.toggle("hidden", v==="login");

  if(v==="login") $("viewLogin").classList.remove("hidden");
  if(v==="delegate") $("viewDelegate").classList.remove("hidden");
  if(v==="admin") $("viewAdmin").classList.remove("hidden");
}

// ===== RENDER =====
function renderMine(){
  const tb = $("tbodyMine");
  tb.innerHTML = "";
  const list = getMyRecords(SESSION.username);
  list.forEach(r=>{
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
  });
}

function renderAdmin(){
  const tb = $("tbodyAdmin");
  tb.innerHTML = "";
  const all = loadAllRecords();
  USERS.filter(u=>u.role==="delegate").forEach(u=>{
    (all[u.username]||[]).forEach(r=>{
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(u.full_name)}</td>
        <td>${escapeHtml(r.fecha)}</td>
        <td>${escapeHtml(r.lugar)}</td>
        <td>${escapeHtml(r.titulo)}</td>
        <td>${escapeHtml(r.descripcion)}</td>
        <td>${escapeHtml(r.contacto)}</td>
        <td>${escapeHtml(r.telefono)}</td>
      `;
      tb.appendChild(tr);
    });
  });
}

// ===== LOGIN =====
let SESSION = loadSession();

$("btnLogin").addEventListener("click", ()=>{
  $("loginError").textContent = "";
  const u = $("loginUser").value.trim().toLowerCase();
  const p = $("loginPass").value;
  const user = getUser(u);
  if(!user || user.pass!==p){
    $("loginError").textContent = "Credenciales inválidas.";
    return;
  }
  SESSION = { username:user.username, role:user.role };
  saveSession(SESSION);
  $("meLabel").textContent = `${user.full_name} · ${user.role}`;
  if(user.role==="admin"){
    setView("admin");
    renderAdmin();
  }else{
    setView("delegate");
    $("fFecha").value = todayISO();
    renderMine();
  }
});

$("btnLogout").addEventListener("click", ()=>{
  SESSION = null;
  saveSession(null);
  $("meLabel").textContent = "";
  setView("login");
});

// ===== SAVE RECORD =====
$("btnGuardar")?.addEventListener("click", ()=>{
  $("saveMsg").textContent = "";
  const rec = {
    fecha: $("fFecha").value || todayISO(),
    lugar: $("fLugar").value.trim(),
    contacto: $("fContacto").value.trim(),
    telefono: $("fTelefono").value.trim(),
    titulo: $("fTitulo").value.trim(),
    descripcion: $("fDescripcion").value.trim()
  };
  if(!rec.titulo || !rec.descripcion){
    $("saveMsg").textContent = "❌ Título y descripción obligatorios.";
    return;
  }
  const list = getMyRecords(SESSION.username);
  list.push(rec);
  setMyRecords(SESSION.username, list);
  $("saveMsg").textContent = "✅ Guardado.";
  $("fTitulo").value="";
  $("fDescripcion").value="";
  renderMine();
});

// ===== BOOT =====
if(SESSION){
  const u = getUser(SESSION.username);
  if(u){
    $("meLabel").textContent = `${u.full_name} · ${u.role}`;
    if(u.role==="admin"){
      setView("admin");
      renderAdmin();
    }else{
      setView("delegate");
      $("fFecha").value = todayISO();
      renderMine();
    }
  }else{
    setView("login");
  }
}else{
  setView("login");
}
