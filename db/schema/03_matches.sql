CREATE TABLE matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    location TEXT,
    starts_at TIMESTAMPTZ NOT NULL,
    notes TEXT,
    deleted_at TIMESTAMPTZ,
    created_by UUID NOT NULL REFERENCES users(id) DEFAULT current_user_id(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL PRIVILEGES ON TABLE matches TO app_user;

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY matches_select ON matches FOR SELECT TO app_user
    USING (is_group_member(group_id));
CREATE POLICY matches_insert ON matches FOR INSERT TO app_user
    WITH CHECK (is_group_admin(group_id));
CREATE POLICY matches_update ON matches FOR UPDATE TO app_user
    USING (is_group_admin(group_id));
CREATE POLICY matches_delete ON matches FOR DELETE TO app_user
    USING (is_group_admin(group_id));
