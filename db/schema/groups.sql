CREATE TABLE groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    deleted_at TIMESTAMPTZ,
    created_by UUID NOT NULL REFERENCES users(id) DEFAULT current_user_id(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE group_members (
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (group_id, user_id)
);

CREATE TABLE group_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
    created_by UUID NOT NULL REFERENCES users(id) DEFAULT current_user_id(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    disabled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX players_group_user_active ON players (group_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX players_group_name_active ON players (group_id, name) WHERE disabled_at IS NULL;

-- Helper: check if current user is admin of a group
-- SECURITY DEFINER to bypass RLS on group_members (avoids infinite recursion)
CREATE FUNCTION is_group_admin(gid UUID) RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM group_members
        WHERE group_id = gid
          AND user_id = current_user_id()
          AND role = 'admin'
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper: check if current user is member of a group (via players table)
-- SECURITY DEFINER to bypass RLS on players (avoids infinite recursion)
CREATE FUNCTION is_group_member(gid UUID) RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM players
        WHERE group_id = gid
          AND user_id = current_user_id()
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper: check if a group has any members yet (via players table)
-- SECURITY DEFINER to bypass RLS on players
CREATE FUNCTION group_has_members(gid UUID) RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM players WHERE group_id = gid
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Trigger: auto-add group creator as admin on group creation
CREATE FUNCTION add_creator_as_admin() RETURNS TRIGGER AS $$
DECLARE
    v_display_name TEXT;
BEGIN
    INSERT INTO group_members (group_id, user_id)
    VALUES (NEW.id, NEW.created_by);

    SELECT display_name INTO v_display_name FROM users WHERE id = NEW.created_by;

    INSERT INTO players (group_id, user_id, name)
    VALUES (NEW.id, NEW.created_by, COALESCE(v_display_name, 'Player'));

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_group_creator_admin
    AFTER INSERT ON groups
    FOR EACH ROW
    EXECUTE FUNCTION add_creator_as_admin();

-- Join a group using an invite token
-- Validates the token and returns group info + whether user is already a member.
-- Does NOT auto-create a player — the frontend handles claim/create flow.
CREATE FUNCTION join_group_by_invite(invite_token TEXT)
RETURNS TABLE(group_id UUID, user_id UUID, already_member BOOLEAN) AS $$
DECLARE
    v_group_id UUID;
    v_already_member BOOLEAN;
BEGIN
    SELECT gi.group_id INTO v_group_id FROM group_invites gi WHERE gi.token = invite_token;

    IF v_group_id IS NULL THEN
        RAISE EXCEPTION 'Invalid invite token'
            USING ERRCODE = 'P0002';
    END IF;

    -- Check membership via players table
    SELECT EXISTS (
        SELECT 1 FROM players p
        WHERE p.group_id = v_group_id AND p.user_id = current_user_id()
    ) INTO v_already_member;

    RETURN QUERY
    SELECT v_group_id, current_user_id(), v_already_member;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION join_group_by_invite(TEXT) TO app_user;

-- List unlinked players for a group via invite token (SECURITY DEFINER bypasses RLS)
CREATE FUNCTION unlinked_players_for_invite(invite_token TEXT)
RETURNS TABLE(id UUID, name TEXT) AS $$
DECLARE
    v_group_id UUID;
BEGIN
    SELECT gi.group_id INTO v_group_id FROM group_invites gi WHERE gi.token = invite_token;

    IF v_group_id IS NULL THEN
        RAISE EXCEPTION 'Invalid invite token' USING ERRCODE = 'P0002';
    END IF;

    RETURN QUERY
    SELECT p.id, p.name FROM players p
    WHERE p.group_id = v_group_id AND p.user_id IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION unlinked_players_for_invite(TEXT) TO app_user;

-- Complete joining a group: either claim an existing unlinked player or create a new one
-- Pass p_player_id to claim, or p_name to create (exactly one must be provided)
CREATE FUNCTION complete_join_by_invite(invite_token TEXT, p_player_id UUID DEFAULT NULL, p_name TEXT DEFAULT NULL)
RETURNS players AS $$
DECLARE
    v_group_id UUID;
    v_player players;
BEGIN
    SELECT gi.group_id INTO v_group_id FROM group_invites gi WHERE gi.token = invite_token;

    IF v_group_id IS NULL THEN
        RAISE EXCEPTION 'Invalid invite token' USING ERRCODE = 'P0002';
    END IF;

    -- User must not already have a player in this group
    IF EXISTS (SELECT 1 FROM players WHERE group_id = v_group_id AND user_id = current_user_id()) THEN
        RAISE EXCEPTION 'You already have a player in this group' USING ERRCODE = 'P0005';
    END IF;

    IF p_player_id IS NOT NULL THEN
        -- Claim an existing unlinked player
        SELECT * INTO v_player FROM players WHERE id = p_player_id AND group_id = v_group_id;

        IF v_player IS NULL THEN
            RAISE EXCEPTION 'Player not found in this group' USING ERRCODE = 'P0002';
        END IF;

        IF v_player.user_id IS NOT NULL THEN
            RAISE EXCEPTION 'Player is already linked to a user' USING ERRCODE = 'P0004';
        END IF;

        UPDATE players SET user_id = current_user_id() WHERE id = p_player_id RETURNING * INTO v_player;
    ELSIF p_name IS NOT NULL THEN
        -- Create a new player
        INSERT INTO players (group_id, user_id, name)
        VALUES (v_group_id, current_user_id(), p_name)
        RETURNING * INTO v_player;
    ELSE
        RAISE EXCEPTION 'Must provide either p_player_id or p_name' USING ERRCODE = 'P0001';
    END IF;

    RETURN v_player;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION complete_join_by_invite(TEXT, UUID, TEXT) TO app_user;

-- Disable a player (soft-delete): admin-only, cannot self-disable
CREATE FUNCTION disable_player(p_player_id UUID) RETURNS VOID AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION disable_player(UUID) TO app_user;

-- Re-enable a disabled player (admin-only)
CREATE FUNCTION enable_player(p_player_id UUID) RETURNS VOID AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION enable_player(UUID) TO app_user;

-- RLS: groups
GRANT ALL PRIVILEGES ON TABLE groups TO app_user;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY groups_select ON groups FOR SELECT TO app_user
    USING (is_group_member(id) OR is_group_admin(id) OR (created_by = current_user_id() AND NOT group_has_members(id)));
CREATE POLICY groups_insert ON groups FOR INSERT TO app_user
    WITH CHECK (true);
CREATE POLICY groups_update ON groups FOR UPDATE TO app_user
    USING (is_group_admin(id));
CREATE POLICY groups_delete ON groups FOR DELETE TO app_user
    USING (is_group_admin(id));

-- RLS: group_members (admin tracking only)
GRANT SELECT, INSERT, DELETE ON group_members TO app_user;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY groups_members_select ON group_members FOR SELECT TO app_user
    USING (is_group_member(group_id) OR is_group_admin(group_id));

CREATE POLICY group_members_insert ON group_members FOR INSERT TO app_user
    WITH CHECK (is_group_admin(group_id));

CREATE POLICY group_members_delete ON group_members FOR DELETE TO app_user
    USING (is_group_admin(group_id) AND user_id <> current_user_id());

-- No UPDATE policy needed: presence = admin, no role to update

-- RLS: group_invites (admin-only)
GRANT ALL PRIVILEGES ON TABLE group_invites TO app_user;
ALTER TABLE group_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY group_invites_select ON group_invites FOR SELECT TO app_user
    USING (is_group_admin(group_id));
CREATE POLICY group_invites_insert ON group_invites FOR INSERT TO app_user
    WITH CHECK (is_group_admin(group_id));
CREATE POLICY group_invites_delete ON group_invites FOR DELETE TO app_user
    USING (is_group_admin(group_id));


GRANT SELECT, UPDATE ON users TO app_user;

-- Helper: check if a user shares any group with the current user
-- SECURITY DEFINER to bypass RLS on players
CREATE FUNCTION shares_group_with_current_user(uid UUID) RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM players p1
        JOIN players p2 ON p1.group_id = p2.group_id
        WHERE p1.user_id = current_user_id()
          AND p2.user_id = uid
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_select ON users FOR SELECT TO app_user
    USING (id = current_user_id() OR shares_group_with_current_user(id));

CREATE POLICY users_update ON users FOR UPDATE TO app_user
    USING (id = current_user_id());
