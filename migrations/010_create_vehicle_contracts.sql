-- Contratto di noleggio a lungo termine di ogni vettura: base per il controllo dei km inclusi e delle scadenze.
-- La fonte è il file flotta mantenuto dall'ufficio (import da Excel); i km usati si calcolano dal contachilometri
-- del sensore meno i km alla consegna (verbale di consegna).
CREATE TABLE IF NOT EXISTS vehicle_contracts (
  vehicle_id             INTEGER PRIMARY KEY REFERENCES vehicles(id) ON DELETE CASCADE,
  lessor                 TEXT,            -- noleggiatore (Arval, Leasys, Santander...)
  contract_number        TEXT,
  delivery_date          DATE,            -- consegna / MAD
  months                 INTEGER,         -- durata
  km_annual              INTEGER,
  km_total               INTEGER,         -- km totali inclusi nel contratto
  km_increase_requested  INTEGER,         -- aumento km richiesto al noleggiatore (non ancora applicato ai calcoli)
  end_date               DATE,            -- scadenza contratto
  extra_km_cost          NUMERIC(8,4),    -- euro per ogni km oltre i km inclusi
  km_total_extended      INTEGER,         -- km totali dopo una proroga
  end_date_extended      DATE,            -- scadenza dopo la proroga
  extension_note         TEXT,
  odometer_start         INTEGER,         -- contachilometri alla consegna
  odometer_start_source  TEXT,            -- verbale | manuale | brainy
  category               TEXT,            -- autovettura / furgone
  status                 TEXT,            -- operativa, restituita, ordinata...
  user_company           TEXT,            -- azienda utilizzatrice
  driver_name            TEXT,            -- dato personale: visibile solo a chi gestisce
  source                 TEXT,
  imported_at            TIMESTAMPTZ,
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
