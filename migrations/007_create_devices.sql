-- Sensori che inviano dati direttamente al server (senza DIMO): IMEI -> veicolo.
-- Solo gli IMEI presenti e abilitati vengono accettati dall'endpoint di ricezione.
CREATE TABLE IF NOT EXISTS devices (
  imei            BIGINT PRIMARY KEY,
  vehicle_id      INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  label           TEXT,
  profile         TEXT NOT NULL DEFAULT 'mercedes-lcv',
  enabled         BOOLEAN NOT NULL DEFAULT TRUE,
  usage_start     DATE,                                   -- T0: primo giorno di utilizzo della SIM (il mese di consumo parte da qui)
  allowance_bytes BIGINT NOT NULL DEFAULT 1000000000,     -- 1 GB al mese per SIM
  last_seen_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS devices_vehicle_idx ON devices (vehicle_id);

-- Traffico per sensore e per giorno (giorno di Roma), contato dal ricevitore.
-- est_bytes = dati ricevuti + ACK + stima delle intestazioni IP/TCP e dei collegamenti.
CREATE TABLE IF NOT EXISTS device_usage (
  imei        BIGINT NOT NULL REFERENCES devices(imei) ON DELETE CASCADE,
  day         DATE NOT NULL,
  bytes_in    BIGINT NOT NULL DEFAULT 0,
  bytes_out   BIGINT NOT NULL DEFAULT 0,
  packets     INTEGER NOT NULL DEFAULT 0,
  connections INTEGER NOT NULL DEFAULT 0,
  est_bytes   BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (imei, day)
);

-- Chiusura di fine giornata: consumo del giorno, consumo cumulato nel mese di utilizzo e % della soglia.
CREATE TABLE IF NOT EXISTS device_usage_reports (
  imei            BIGINT NOT NULL REFERENCES devices(imei) ON DELETE CASCADE,
  day             DATE NOT NULL,
  day_bytes       BIGINT NOT NULL,
  cycle_bytes     BIGINT NOT NULL,
  cycle_start     DATE NOT NULL,
  allowance_bytes BIGINT NOT NULL,
  percent         NUMERIC(6,2) NOT NULL,
  alert           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (imei, day)
);
