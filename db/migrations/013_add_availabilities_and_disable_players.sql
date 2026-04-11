CREATE TABLE weekly_availability (
    group_id uuid,
    player_id uuid,
    day_of_week smallint,
    time_slot smallint,
    CONSTRAINT weekly_availability_pkey PRIMARY KEY (group_id, player_id, day_of_week, time_slot),
    CONSTRAINT weekly_availability_player_id_fkey FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE RESTRICT,
    CONSTRAINT weekly_availability_day_of_week_check CHECK (day_of_week >= 0 AND day_of_week <= 6),
    CONSTRAINT weekly_availability_time_slot_check CHECK (time_slot >= 0 AND time_slot <= 47)
);

ALTER TABLE weekly_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY weekly_availability_delete ON weekly_availability FOR DELETE TO app_user USING (player_id = current_player_id(group_id));

CREATE POLICY weekly_availability_insert ON weekly_availability FOR INSERT TO app_user WITH CHECK (player_id = current_player_id(group_id));

CREATE POLICY weekly_availability_select ON weekly_availability FOR SELECT TO app_user USING (is_group_member(group_id));

CREATE OR REPLACE FUNCTION disable_player(
    p_player_id uuid
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
AS $$
DECLARE
    v_player RECORD;
BEGIN
    SELECT * INTO v_player FROM players WHERE id = p_player_id;

    IF v_player IS NULL THEN
        RAISE EXCEPTION 'Player not found' USING ERRCODE = 'P0002';
    END IF;

    IF NOT is_group_admin(v_player.group_id) THEN
        RAISE EXCEPTION 'Only admins can disable players' USING ERRCODE = 'P0003';
    END IF;

    IF v_player.user_id = current_user_id() THEN
        RAISE EXCEPTION 'Cannot disable yourself' USING ERRCODE = 'P0004';
    END IF;

    -- Soft-disable the player
    UPDATE players SET disabled_at = now() WHERE id = p_player_id;
END;
$$;

CREATE OR REPLACE FUNCTION enable_player(
    p_player_id uuid
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
AS $$
DECLARE
    v_player RECORD;
BEGIN
    SELECT * INTO v_player FROM players WHERE id = p_player_id AND disabled_at IS NOT NULL;

    IF v_player IS NULL THEN
        RAISE EXCEPTION 'Disabled player not found' USING ERRCODE = 'P0002';
    END IF;

    IF NOT is_group_admin(v_player.group_id) THEN
        RAISE EXCEPTION 'Only admins can enable players' USING ERRCODE = 'P0003';
    END IF;

    UPDATE players SET disabled_at = NULL WHERE id = p_player_id;
END;
$$;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

ALTER TABLE weekly_availability
ADD CONSTRAINT weekly_availability_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups (id) ON DELETE CASCADE;

CREATE VIEW availability_summary WITH (security_barrier=true) AS
 SELECT wa.group_id,
    wa.day_of_week,
    wa.time_slot,
    count(*)::integer AS player_count,
    array_agg(p.name ORDER BY p.name) AS player_names
   FROM weekly_availability wa
     JOIN players p ON p.id = wa.player_id
  GROUP BY wa.group_id, wa.day_of_week, wa.time_slot
 HAVING is_group_member(wa.group_id);

ALTER TABLE attendance ADD COLUMN created_at timestamptz DEFAULT now() NOT NULL;

ALTER TABLE attendance DROP CONSTRAINT attendance_player_id_fkey;

ALTER TABLE attendance
ADD CONSTRAINT attendance_player_id_fkey FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE RESTRICT NOT VALID;

ALTER TABLE attendance VALIDATE CONSTRAINT attendance_player_id_fkey;

CREATE OR REPLACE TRIGGER attendance_set_updated_at
    BEFORE UPDATE ON attendance
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

ALTER TABLE match_teams DROP CONSTRAINT match_teams_player_id_fkey;

ALTER TABLE match_teams
ADD CONSTRAINT match_teams_player_id_fkey FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE RESTRICT NOT VALID;

ALTER TABLE match_teams VALIDATE CONSTRAINT match_teams_player_id_fkey;

ALTER TABLE matches ADD COLUMN player_quota integer DEFAULT 10 NOT NULL;

ALTER TABLE player_ratings DROP CONSTRAINT player_ratings_player_id_fkey;

ALTER TABLE player_ratings
ADD CONSTRAINT player_ratings_player_id_fkey FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE RESTRICT NOT VALID;

ALTER TABLE player_ratings VALIDATE CONSTRAINT player_ratings_player_id_fkey;

ALTER TABLE players DROP CONSTRAINT players_group_id_name_key;

ALTER TABLE players DROP CONSTRAINT players_group_id_user_id_key;

ALTER TABLE players ADD COLUMN disabled_at timestamptz;

CREATE UNIQUE INDEX players_group_name_active ON players (group_id, name) WHERE (disabled_at IS NULL);

-- pgschema:wait
SELECT
    COALESCE(i.indisvalid, false) as done,
    CASE
        WHEN p.blocks_total > 0 THEN p.blocks_done * 100 / p.blocks_total
        ELSE 0
    END as progress
FROM pg_class c
LEFT JOIN pg_index i ON c.oid = i.indexrelid
LEFT JOIN pg_stat_progress_create_index p ON c.oid = p.index_relid
WHERE c.relname = 'players_group_name_active';

CREATE UNIQUE INDEX players_group_user_active ON players (group_id, user_id) WHERE (user_id IS NOT NULL);

ALTER VIEW player_vote_averages SET (security_barrier=true);

CREATE OR REPLACE FUNCTION current_player_id(
    gid uuid
)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT id FROM players WHERE group_id = gid AND user_id = current_user_id() AND disabled_at IS NULL;
$$;

GRANT EXECUTE ON FUNCTION disable_player(p_player_id uuid) TO app_user;

GRANT EXECUTE ON FUNCTION enable_player(p_player_id uuid) TO app_user;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE weekly_availability TO app_user;

GRANT SELECT ON TABLE availability_summary TO app_user;
