CREATE FUNCTION current_player_id(gid UUID) RETURNS UUID AS $$
    SELECT id FROM players WHERE group_id = gid AND user_id = current_user_id() AND disabled_at IS NULL;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION current_player_id(UUID) TO app_user;

-- RLS
GRANT ALL PRIVILEGES ON TABLE players TO app_user;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

-- Members can see all players in their groups
CREATE POLICY players_select ON players FOR SELECT TO app_user
    USING (is_group_admin(group_id) OR is_group_member(group_id));

-- Admins can insert any player; members can insert their own
CREATE POLICY players_insert ON players FOR INSERT TO app_user
    WITH CHECK (
        is_group_admin(group_id)
        OR (is_group_member(group_id) AND user_id = current_user_id())
    );

-- Admins can update any player; members can update players where user_id = current_user_id()
CREATE POLICY players_update ON players FOR UPDATE TO app_user
    USING (
        is_group_admin(group_id)
        OR user_id = current_user_id()
    );

-- Only admins can delete players
CREATE POLICY players_delete ON players FOR DELETE TO app_user
    USING (is_group_admin(group_id));
