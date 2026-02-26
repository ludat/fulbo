ALTER TABLE groups ADD COLUMN deleted_at timestamptz;

ALTER TABLE matches ADD COLUMN deleted_at timestamptz;
