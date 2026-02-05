CREATE TABLE IF NOT EXISTS leaders (
  id SERIAL PRIMARY KEY,
  delegate_username TEXT NOT NULL,
  nombre TEXT NOT NULL,
  documento TEXT NOT NULL,
  telefono TEXT DEFAULT '',
  direccion TEXT DEFAULT '',
  zona TEXT DEFAULT '', -- (se mantiene por compatibilidad, aunque ya no se use en frontend)
  tipo TEXT NOT NULL CHECK (tipo IN ('A','B','C')),
  compromiso TEXT NOT NULL CHECK (compromiso IN ('Comprometido','No ubicado','No apoya')),
  observacion TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Un líder por documento por cada delegado
CREATE UNIQUE INDEX IF NOT EXISTS uniq_leaders_delegate_documento
ON leaders(delegate_username, documento);

CREATE INDEX IF NOT EXISTS idx_leaders_delegate ON leaders(delegate_username);
CREATE INDEX IF NOT EXISTS idx_leaders_compromiso ON leaders(compromiso);
CREATE INDEX IF NOT EXISTS idx_leaders_tipo ON leaders(tipo);

-- MIGRACIÓN SEGURA (por si ya existía la tabla sin la columna)
ALTER TABLE leaders
  ADD COLUMN IF NOT EXISTS observacion TEXT DEFAULT '';

CREATE TABLE IF NOT EXISTS people (
  id SERIAL PRIMARY KEY,
  delegate_username TEXT NOT NULL,
  leader_id INTEGER NOT NULL REFERENCES leaders(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  documento TEXT NOT NULL,
  telefono TEXT DEFAULT '',
  direccion TEXT DEFAULT '',
  zona TEXT DEFAULT '',
  conoce BOOLEAN NOT NULL DEFAULT false,
  compromete BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Una persona por documento por cada delegado
CREATE UNIQUE INDEX IF NOT EXISTS uniq_people_delegate_documento
ON people(delegate_username, documento);

CREATE INDEX IF NOT EXISTS idx_people_delegate ON people(delegate_username);
CREATE INDEX IF NOT EXISTS idx_people_leader ON people(leader_id);
