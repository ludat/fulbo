CREATE TABLE attendance (
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('going', 'not_going', 'maybe')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (match_id, player_id)
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER attendance_set_updated_at
    BEFORE UPDATE ON attendance
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

GRANT ALL PRIVILEGES ON TABLE attendance TO app_user;

ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- Members can see attendance for matches in their groups
CREATE POLICY attendance_select ON attendance FOR SELECT TO app_user
    USING (is_group_member((SELECT group_id FROM matches WHERE id = match_id)));

-- Members can set their own attendance (via player_id), admins can set anyone's
CREATE POLICY attendance_insert ON attendance FOR INSERT TO app_user
    WITH CHECK (
        player_id = current_player_id((SELECT group_id FROM matches WHERE id = match_id))
        OR is_group_admin((SELECT group_id FROM matches WHERE id = match_id))
    );

CREATE POLICY attendance_update ON attendance FOR UPDATE TO app_user
    USING (
        player_id = current_player_id((SELECT group_id FROM matches WHERE id = match_id))
        OR is_group_admin((SELECT group_id FROM matches WHERE id = match_id))
    );

CREATE POLICY attendance_delete ON attendance FOR DELETE TO app_user
    USING (
        player_id = current_player_id((SELECT group_id FROM matches WHERE id = match_id))
        OR is_group_admin((SELECT group_id FROM matches WHERE id = match_id))
    );
