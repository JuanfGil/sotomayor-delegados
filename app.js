console.log("✅ app.js cargó");

const USERS = [
  { username: "claudia", role: "delegate", full_name: "Claudia Leiton", pass: "1234" },
  { username: "angela", role: "delegate", full_name: "Angela Delgado", pass: "1234" },
  { username: "ana", role: "delegate", full_name: "Ana María Peñaranda", pass: "1234" },
  { username: "gloria", role: "delegate", full_name: "Gloria Yela", pass: "1234" },
  { username: "jose", role: "delegate", full_name: "José Melo", pass: "1234" },
  { username: "yonny", role: "admin", full_name: "Yonny Delgado", pass: "1234" }
];

const $ = (id) => document.getElementById(id);

function setView(view) {
  $("viewLogin").classList.add("hidden");
  $("viewDelegate").classList.add("hidden");
  $("viewAdmin").classList.add("hidden");

  $("btnLogout").classList.toggle("hidden", view === "login");

  if (view === "login") $("viewLogin").classList.remove("hidden");
  if (view === "delegate") $("viewDelegate").classList.remove("hidden");
  if (view === "admin") $("viewAdmin").classList.remove("hidden");
}

function findUser(username) {
  return USERS.find(u => u.username === username) || null;
}

$("btnLogin").addEventListener("click", () => {
  $("loginError").textContent = "";

  const username = $("loginUser").value.trim().toLowerCase();
  const password = $("loginPass").value;

  const u = findUser(username);
  if (!u || u.pass !== password) {
    $("loginError").textContent = "Usuario o contraseña incorrectos.";
    return;
  }

  $("meLabel").textContent = `${u.full_name} · ${u.role}`;
  setView(u.role === "admin" ? "admin" : "delegate");
});

$("btnLogout").addEventListener("click", () => {
  $("meLabel").textContent = "";
  $("loginUser").value = "";
  $("loginPass").value = "";
  $("loginError").textContent = "";
  setView("login");
});

setView("login");
