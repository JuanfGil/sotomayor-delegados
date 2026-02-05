require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");

const app = express();
app.use(express.json({ limit: "1mb" }));

// ---------- Config ----------
const PORT = process.env.PORT || 10000;
const DATABASE_URL = process.env.DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET || "cambia-esto";
const JWT_TTL = process.env.JWT_TTL || "8h";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

// CORS: permite GitHub Pages y localhost (si pones '*', deja abierto)
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (CORS_ORIGIN === "*") return cb(null, true);

      const allowed = CORS_ORIGIN.split(",").map(s => s.trim()).filter(Boolean);
      if (allowed.includes(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS"));
    },
    credentials: true
  })
);

if (!DATABASE_URL) {
  console.error("Falta DATABASE_URL");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

function safeJsonParse(str, fallback) {
  try { return JSON.parse(str); } catch { return fallback; }
}

const USERS = safeJsonParse(process.env.USERS_JSON || "[]", []);
// fallback por si no ponen USERS_JSON
const DEFAULT_USERS = [
  { username:"claudia", pass:"1234", role:"delegate", full_name:"Claudia Leiton" },
  { username:"angela", pass:"1234", role:"delegate", full_name:"Angela Delgado" },
  { username:"ana", pass:"1234", role:"delegate", full_name:"Ana María Peñaranda" },
  { username:"gloria", pass:"1234", role:"delegate", full_name:"Gloria Yela" },
  { username:"jose", pass:"1234", role:"delegate", full_name:"José Melo" },
  { username:"yonny", pass:"1234", role:"admin", full_name:"Yonny Delgado" }
];

function getUsers() {
  return (Array.isArray(USERS) && USERS.length) ? USERS : DEFAULT_USERS;
}

function findUser(username) {
  return getUsers().find(u => u.username === username) || null;
}

function signToken(user) {
  return jwt.sign(
    { username: user.username, role: user.role, full_name: user.full_name },
    JWT_SECRET,
    { expiresIn: JWT_TTL }
  );
}

function auth(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: "No token" });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ error: "Token inválido o vencido" });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "No session" });
    if (req.user.role !== role) return res.status(403).json({ error: "No autorizado" });
    next();
  };
}

function canAccessDelegate(reqUser, delegateUsername) {
  if (reqUser.role === "admin") return true;
  return reqUser.username === delegateUsername;
}

async function runMigrations() {
  const sql = require("fs").readFileSync(__dirname + "/db.sql", "utf8");
  await pool.query(sql);
  console.log("DB OK (migraciones listas)");
}

// ---------- Health ----------
app.get("/", (req, res) => res.json({ ok: true, name: "Sotomayor Backend" }));
app.get("/health", (req, res) => res.json({ ok: true }));

// ---------- Auth ----------
app.post("/auth/login", (req, res) => {
  const username = String(req.body.username || "").trim().toLowerCase();
  const pass = String(req.body.password || "");

  const u = findUser(username);
  if (!u || u.pass !== pass) return res.status(401).json({ error: "Credenciales inválidas" });

  const token = signToken(u);
  res.json({
    token,
    user: { username: u.username, role: u.role, full_name: u.full_name }
  });
});

app.get("/me", auth, (req, res) => {
  res.json({ user: req.user });
});

// ---------- Leaders ----------
app.get("/leaders", auth, async (req, res) => {
  const delegate = String(req.query.delegate || "").trim().toLowerCase();

  // delegate puede pedir solo lo suyo; admin puede filtrar o ver todo
  if (delegate && !canAccessDelegate(req.user, delegate)) {
    return res.status(403).json({ error: "No autorizado" });
  }

  const values = [];
  let where = "";
  if (req.user.role === "delegate") {
    values.push(req.user.username);
    where = `WHERE delegate_username = $${values.length}`;
  } else if (delegate) {
    values.push(delegate);
    where = `WHERE delegate_username = $${values.length}`;
  }

  const q = `
    SELECT id, delegate_username, nombre, documento, telefono, direccion, zona, tipo, compromiso, created_at, updated_at
    FROM leaders
    ${where}
    ORDER BY created_at DESC
  `;
  const r = await pool.query(q, values);
  res.json({ leaders: r.rows });
});

app.post("/leaders", auth, requireRole("delegate"), async (req, res) => {
  const d = req.user.username;
  const body = req.body || {};

  const nombre = String(body.nombre || "").trim();
  const documento = String(body.documento || "").trim();
  const telefono = String(body.telefono || "").trim();
  const direccion = String(body.direccion || "").trim();
  const zona = String(body.zona || "").trim();
  const tipo = String(body.tipo || "A").trim();
  const compromiso = String(body.compromiso || "Comprometido").trim();

  if (!nombre || !documento) return res.status(400).json({ error: "nombre y documento son obligatorios" });

  const q = `
    INSERT INTO leaders (delegate_username, nombre, documento, telefono, direccion, zona, tipo, compromiso)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    RETURNING *
  `;
  try {
    const r = await pool.query(q, [d, nombre, documento, telefono, direccion, zona, tipo, compromiso]);
    res.json({ leader: r.rows[0] });
  } catch (e) {
    if (String(e.message || "").includes("uniq_leaders_delegate_documento")) {
      return res.status(409).json({ error: "Ya existe un líder con ese documento para este delegado" });
    }
    res.status(500).json({ error: "Error creando líder" });
  }
});

app.put("/leaders/:id", auth, requireRole("delegate"), async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "id inválido" });

  const body = req.body || {};
  const nombre = String(body.nombre || "").trim();
  const documento = String(body.documento || "").trim();
  const telefono = String(body.telefono || "").trim();
  const direccion = String(body.direccion || "").trim();
  const zona = String(body.zona || "").trim();
  const tipo = String(body.tipo || "A").trim();
  const compromiso = String(body.compromiso || "Comprometido").trim();

  if (!nombre || !documento) return res.status(400).json({ error: "nombre y documento son obligatorios" });

  // solo puede actualizar líderes propios
  const q = `
    UPDATE leaders
    SET nombre=$1, documento=$2, telefono=$3, direccion=$4, zona=$5, tipo=$6, compromiso=$7, updated_at=now()
    WHERE id=$8 AND delegate_username=$9
    RETURNING *
  `;
  try {
    const r = await pool.query(q, [nombre, documento, telefono, direccion, zona, tipo, compromiso, id, req.user.username]);
    if (!r.rows.length) return res.status(404).json({ error: "No encontrado" });
    res.json({ leader: r.rows[0] });
  } catch (e) {
    if (String(e.message || "").includes("uniq_leaders_delegate_documento")) {
      return res.status(409).json({ error: "Ya existe un líder con ese documento para este delegado" });
    }
    res.status(500).json({ error: "Error actualizando líder" });
  }
});

app.delete("/leaders/:id", auth, requireRole("delegate"), async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "id inválido" });

  // ON DELETE CASCADE borrará people
  const q = `DELETE FROM leaders WHERE id=$1 AND delegate_username=$2 RETURNING id`;
  const r = await pool.query(q, [id, req.user.username]);
  if (!r.rows.length) return res.status(404).json({ error: "No encontrado" });
  res.json({ ok: true });
});

// ---------- People ----------
app.get("/people", auth, async (req, res) => {
  const delegate = String(req.query.delegate || "").trim().toLowerCase();

  if (delegate && !canAccessDelegate(req.user, delegate)) {
    return res.status(403).json({ error: "No autorizado" });
  }

  const values = [];
  let where = "";
  if (req.user.role === "delegate") {
    values.push(req.user.username);
    where = `WHERE p.delegate_username = $${values.length}`;
  } else if (delegate) {
    values.push(delegate);
    where = `WHERE p.delegate_username = $${values.length}`;
  }

  const q = `
    SELECT
      p.id, p.delegate_username, p.leader_id, l.nombre AS leader_nombre,
      p.nombre, p.documento, p.telefono, p.direccion, p.zona,
      p.conoce, p.compromete, p.created_at, p.updated_at
    FROM people p
    JOIN leaders l ON l.id = p.leader_id
    ${where}
    ORDER BY p.created_at DESC
  `;
  const r = await pool.query(q, values);
  res.json({ people: r.rows });
});

app.post("/people", auth, requireRole("delegate"), async (req, res) => {
  const d = req.user.username;
  const body = req.body || {};

  const leader_id = Number(body.leader_id);
  const nombre = String(body.nombre || "").trim();
  const documento = String(body.documento || "").trim();
  const telefono = String(body.telefono || "").trim();
  const direccion = String(body.direccion || "").trim();
  const zona = String(body.zona || "").trim();
  const conoce = !!body.conoce;
  const compromete = !!body.compromete;

  if (!leader_id) return res.status(400).json({ error: "leader_id es obligatorio" });
  if (!nombre || !documento) return res.status(400).json({ error: "nombre y documento son obligatorios" });

  // validar que el líder sea del mismo delegado
  const chk = await pool.query(`SELECT id FROM leaders WHERE id=$1 AND delegate_username=$2`, [leader_id, d]);
  if (!chk.rows.length) return res.status(403).json({ error: "Ese líder no pertenece a este delegado" });

  const q = `
    INSERT INTO people (delegate_username, leader_id, nombre, documento, telefono, direccion, zona, conoce, compromete)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    RETURNING *
  `;
  try {
    const r = await pool.query(q, [d, leader_id, nombre, documento, telefono, direccion, zona, conoce, compromete]);
    res.json({ person: r.rows[0] });
  } catch (e) {
    if (String(e.message || "").includes("uniq_people_delegate_documento")) {
      return res.status(409).json({ error: "Ya existe una persona con ese documento para este delegado" });
    }
    res.status(500).json({ error: "Error creando persona" });
  }
});

app.put("/people/:id", auth, requireRole("delegate"), async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "id inválido" });

  const body = req.body || {};
  const leader_id = Number(body.leader_id);
  const nombre = String(body.nombre || "").trim();
  const documento = String(body.documento || "").trim();
  const telefono = String(body.telefono || "").trim();
  const direccion = String(body.direccion || "").trim();
  const zona = String(body.zona || "").trim();
  const conoce = !!body.conoce;
  const compromete = !!body.compromete;

  if (!leader_id) return res.status(400).json({ error: "leader_id es obligatorio" });
  if (!nombre || !documento) return res.status(400).json({ error: "nombre y documento son obligatorios" });

  // validar líder propio
  const chk = await pool.query(`SELECT id FROM leaders WHERE id=$1 AND delegate_username=$2`, [leader_id, req.user.username]);
  if (!chk.rows.length) return res.status(403).json({ error: "Ese líder no pertenece a este delegado" });

  const q = `
    UPDATE people
    SET leader_id=$1, nombre=$2, documento=$3, telefono=$4, direccion=$5, zona=$6,
        conoce=$7, compromete=$8, updated_at=now()
    WHERE id=$9 AND delegate_username=$10
    RETURNING *
  `;
  try {
    const r = await pool.query(q, [leader_id, nombre, documento, telefono, direccion, zona, conoce, compromete, id, req.user.username]);
    if (!r.rows.length) return res.status(404).json({ error: "No encontrado" });
    res.json({ person: r.rows[0] });
  } catch (e) {
    if (String(e.message || "").includes("uniq_people_delegate_documento")) {
      return res.status(409).json({ error: "Ya existe una persona con ese documento para este delegado" });
    }
    res.status(500).json({ error: "Error actualizando persona" });
  }
});

app.delete("/people/:id", auth, requireRole("delegate"), async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "id inválido" });

  const q = `DELETE FROM people WHERE id=$1 AND delegate_username=$2 RETURNING id`;
  const r = await pool.query(q, [id, req.user.username]);
  if (!r.rows.length) return res.status(404).json({ error: "No encontrado" });
  res.json({ ok: true });
});

// ---------- Reports ----------
app.get("/reports/delegate/:username", auth, async (req, res) => {
  const u = String(req.params.username || "").trim().toLowerCase();
  if (!u) return res.status(400).json({ error: "username requerido" });
  if (!canAccessDelegate(req.user, u)) return res.status(403).json({ error: "No autorizado" });

  const q1 = `SELECT COUNT(*)::int AS total FROM leaders WHERE delegate_username=$1`;
  const q2 = `SELECT COUNT(*)::int AS total FROM people WHERE delegate_username=$1`;
  const qTipo = `SELECT tipo, COUNT(*)::int AS total FROM leaders WHERE delegate_username=$1 GROUP BY tipo`;
  const qComp = `SELECT compromiso, COUNT(*)::int AS total FROM leaders WHERE delegate_username=$1 GROUP BY compromiso`;
  const qKnow = `SELECT SUM(CASE WHEN conoce THEN 1 ELSE 0 END)::int AS conoce, SUM(CASE WHEN compromete THEN 1 ELSE 0 END)::int AS compromete FROM people WHERE delegate_username=$1`;

  const [rL, rP, rT, rC, rK] = await Promise.all([
    pool.query(q1, [u]),
    pool.query(q2, [u]),
    pool.query(qTipo, [u]),
    pool.query(qComp, [u]),
    pool.query(qKnow, [u])
  ]);

  res.json({
    delegate: u,
    leaders: rL.rows[0].total,
    people: rP.rows[0].total,
    tipo: rT.rows,
    compromiso: rC.rows,
    flags: rK.rows[0] || { conoce:0, compromete:0 }
  });
});

app.get("/reports/general", auth, requireRole("admin"), async (req, res) => {
  const qL = `SELECT COUNT(*)::int AS total FROM leaders`;
  const qP = `SELECT COUNT(*)::int AS total FROM people`;
  const qByDelL = `SELECT delegate_username, COUNT(*)::int AS total FROM leaders GROUP BY delegate_username ORDER BY delegate_username`;
  const qByDelP = `SELECT delegate_username, COUNT(*)::int AS total FROM people GROUP BY delegate_username ORDER BY delegate_username`;

  const [rL, rP, rDL, rDP] = await Promise.all([
    pool.query(qL),
    pool.query(qP),
    pool.query(qByDelL),
    pool.query(qByDelP)
  ]);

  res.json({
    leaders: rL.rows[0].total,
    people: rP.rows[0].total,
    leaders_by_delegate: rDL.rows,
    people_by_delegate: rDP.rows
  });
});

// ---------- Boot ----------
(async () => {
  try {
    await runMigrations();
    app.listen(PORT, () => console.log("API running on port", PORT));
  } catch (e) {
    console.error("Fallo inicializando:", e);
    process.exit(1);
  }
})();
