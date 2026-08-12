-- 009_equipment_catalog_fields.sql
-- Aligns the legacy borrowing schema with the equipment catalog API.

ALTER TABLE equipment ADD COLUMN IF NOT EXISTS kode_alat TEXT;
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS kategori TEXT DEFAULT 'Lainnya';
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS kondisi TEXT DEFAULT 'bagus';
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'tersedia';
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS lokasi_penyimpanan TEXT;
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS serial_number TEXT;
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS foto_url TEXT;
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS deskripsi TEXT;
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE equipment
SET kode_alat = kode_qr
WHERE kode_alat IS NULL;

UPDATE equipment
SET kondisi = physical_condition::TEXT
WHERE kondisi IS NULL OR kondisi = 'bagus';

UPDATE equipment
SET status = availability_status::TEXT
WHERE status IS NULL OR status = 'tersedia';

UPDATE equipment
SET foto_url = fotos[1]
WHERE foto_url IS NULL AND array_length(fotos, 1) > 0;

ALTER TABLE equipment ALTER COLUMN kode_alat SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS equipment_kode_alat_unique ON equipment (kode_alat);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'equipment_kategori_check') THEN
    ALTER TABLE equipment ADD CONSTRAINT equipment_kategori_check
      CHECK (kategori IN ('Kamera', 'Lensa', 'Audio', 'Lighting', 'Aksesoris', 'Lainnya'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'equipment_kondisi_check') THEN
    ALTER TABLE equipment ADD CONSTRAINT equipment_kondisi_check
      CHECK (kondisi IN ('bagus', 'sedikit_kerusakan', 'rusak', 'rusak_besar', 'sedang_diperbaiki', 'hilang'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'equipment_status_check') THEN
    ALTER TABLE equipment ADD CONSTRAINT equipment_status_check
      CHECK (status IN ('tersedia', 'dipinjam', 'maintenance'));
  END IF;
END $$;
