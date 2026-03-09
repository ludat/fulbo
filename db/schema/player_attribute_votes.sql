CREATE TABLE player_attribute_votes (
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    attribute_id UUID NOT NULL REFERENCES player_attributes(id) ON DELETE CASCADE,
    voter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating INT NOT NULL,
    PRIMARY KEY (group_id, player_id, attribute_id, voter_id)
);

GRANT ALL PRIVILEGES ON TABLE player_attribute_votes TO app_user;
ALTER TABLE player_attribute_votes ENABLE ROW LEVEL SECURITY;

-- Members can see their own votes; admins can see all votes in their groups
CREATE POLICY player_attribute_votes_select ON player_attribute_votes FOR SELECT TO app_user
    USING (
        (is_group_member(group_id) AND voter_id = current_user_id())
        OR is_group_admin(group_id)
    );

-- Members can vote for other players (not themselves), voter_id must be current user
CREATE POLICY player_attribute_votes_insert ON player_attribute_votes FOR INSERT TO app_user
    WITH CHECK (
        is_group_member(group_id)
        AND voter_id = current_user_id()
        AND player_id != current_player_id(group_id)
    );

-- Members can update only their own votes
CREATE POLICY player_attribute_votes_update ON player_attribute_votes FOR UPDATE TO app_user
    USING (
        is_group_member(group_id)
        AND voter_id = current_user_id()
    );

-- Members can delete only their own votes
CREATE POLICY player_attribute_votes_delete ON player_attribute_votes FOR DELETE TO app_user
    USING (
        is_group_member(group_id)
        AND voter_id = current_user_id()
    );
