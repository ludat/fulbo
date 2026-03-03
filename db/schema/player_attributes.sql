CREATE TABLE player_attributes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    abbreviation TEXT CHECK (length(abbreviation) <= 3),
    display_order INT NOT NULL DEFAULT 0,
    UNIQUE(group_id, name)
);

GRANT ALL PRIVILEGES ON TABLE player_attributes TO app_user;
ALTER TABLE player_attributes ENABLE ROW LEVEL SECURITY;

CREATE POLICY player_attributes_select ON player_attributes FOR SELECT TO app_user
    USING (is_group_admin(group_id));

CREATE POLICY player_attributes_insert ON player_attributes FOR INSERT TO app_user
    WITH CHECK (is_group_admin(group_id));

CREATE POLICY player_attributes_update ON player_attributes FOR UPDATE TO app_user
    USING (is_group_admin(group_id));

CREATE POLICY player_attributes_delete ON player_attributes FOR DELETE TO app_user
    USING (is_group_admin(group_id));
