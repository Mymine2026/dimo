-- I documenti puntavano alla tabella vecchia admin_vehicles: li colleghiamo a vehicles.
-- Eseguita una sola volta (controlla verso quale tabella punta oggi il vincolo), quindi rilanciabile.
DO $$
DECLARE target regclass;
BEGIN
  SELECT confrelid INTO target FROM pg_constraint WHERE conname = 'documents_vehicle_id_fkey';
  IF target = 'admin_vehicles'::regclass THEN
    ALTER TABLE documents DROP CONSTRAINT documents_vehicle_id_fkey;
    -- vecchio id (admin_vehicles) -> id in vehicles, passando dal token
    UPDATE documents d SET vehicle_id = (
      SELECT v.id FROM vehicles v JOIN admin_vehicles a ON a.token_id = v.token_id::text WHERE a.id = d.vehicle_id
    ) WHERE d.vehicle_id IS NOT NULL;
    -- documenti con il solo token: si risale al veicolo
    UPDATE documents d SET vehicle_id = v.id FROM vehicles v
     WHERE d.vehicle_id IS NULL AND v.token_id::text = d.vehicle_dimo_token;
    ALTER TABLE documents ADD CONSTRAINT documents_vehicle_id_fkey
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL;
  END IF;
END $$;
