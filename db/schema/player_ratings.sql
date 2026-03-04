CREATE TABLE player_ratings (
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    attribute_id UUID NOT NULL REFERENCES player_attributes(id) ON DELETE CASCADE,
    rating INT NOT NULL,
    PRIMARY KEY (group_id, player_id, attribute_id)
);

GRANT ALL PRIVILEGES ON TABLE player_ratings TO app_user;
ALTER TABLE player_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY player_ratings_select ON player_ratings FOR SELECT TO app_user
    USING (is_group_member(group_id));

CREATE POLICY player_ratings_insert ON player_ratings FOR INSERT TO app_user
    WITH CHECK (is_group_admin(group_id));

CREATE POLICY player_ratings_update ON player_ratings FOR UPDATE TO app_user
    USING (is_group_admin(group_id));

CREATE POLICY player_ratings_delete ON player_ratings FOR DELETE TO app_user
    USING (is_group_admin(group_id));
