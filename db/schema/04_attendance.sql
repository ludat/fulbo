CREATE TABLE attendance (
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('going', 'not_going', 'maybe')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (match_id, user_id)
);

GRANT ALL PRIVILEGES ON TABLE attendance TO app_user;

ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- Members can see attendance for matches in their groups
CREATE POLICY attendance_select ON attendance FOR SELECT TO app_user
    USING (is_group_member((SELECT group_id FROM matches WHERE id = match_id)));

-- Members can set their own attendance, admins can set anyone's
CREATE POLICY attendance_insert ON attendance FOR INSERT TO app_user
    WITH CHECK (
        user_id = current_user_id()
        OR is_group_admin((SELECT group_id FROM matches WHERE id = match_id))
    );

CREATE POLICY attendance_update ON attendance FOR UPDATE TO app_user
    USING (
        user_id = current_user_id()
        OR is_group_admin((SELECT group_id FROM matches WHERE id = match_id))
    );

CREATE POLICY attendance_delete ON attendance FOR DELETE TO app_user
    USING (
        user_id = current_user_id()
        OR is_group_admin((SELECT group_id FROM matches WHERE id = match_id))
    );
