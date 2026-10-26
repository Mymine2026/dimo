-- Scheda del veicolo compilata dal libretto di circolazione (carta di circolazione).
-- I veicoli creati dal libretto non hanno un token DIMO: ricevono un token interno NEGATIVO
-- (-nextval) che resta la chiave nelle pagine finché l'app non passa all'id interno.
CREATE SEQUENCE IF NOT EXISTS vehicle_local_token_seq START 1;

CREATE TABLE IF NOT EXISTS vehicle_cards (
  vehicle_id              INTEGER PRIMARY KEY REFERENCES vehicles(id) ON DELETE CASCADE,
  plate                   TEXT,
  vin                     TEXT,
  make                    TEXT,
  model                   TEXT,
  type_approval           TEXT,            -- D.2 tipo/variante/versione
  category                TEXT,            -- J
  fuel                    TEXT,            -- P.3
  displacement_cc         INTEGER,         -- P.1
  power_kw                NUMERIC,         -- P.2
  seats                   INTEGER,         -- S.1
  mass_max_kg             INTEGER,         -- F.1
  mass_service_kg         INTEGER,         -- G
  euro_class              TEXT,
  first_registration      DATE,            -- B
  last_inspection         DATE,
  next_inspection         DATE,
  next_inspection_estimated BOOLEAN NOT NULL DEFAULT FALSE,
  owner_name              TEXT,            -- C.1.1 / C.1.2 (dato personale)
  owner_address           TEXT,            -- C.1.3 (dato personale)
  libretto_document_id    INTEGER REFERENCES documents(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Copia del libretto caricato. Salvata nel database (il container non ha volumi: i file su disco si perderebbero a ogni deploy).
CREATE TABLE IF NOT EXISTS libretto_files (
  id          SERIAL PRIMARY KEY,
  company_id  INTEGER REFERENCES companies(id) ON DELETE SET NULL,
  vehicle_id  INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
  uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  mime        TEXT NOT NULL,
  data        BYTEA NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS libretto_files_vehicle_idx ON libretto_files (vehicle_id);
