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
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
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

-- Helper: check if current user is member of a group
-- SECURITY DEFINER to bypass RLS on group_members (avoids infinite recursion)
CREATE FUNCTION is_group_member(gid UUID) RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM group_members
        WHERE group_id = gid
          AND user_id = current_user_id()
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper: check if a group has any members yet
-- SECURITY DEFINER to bypass RLS on group_members
CREATE FUNCTION group_has_members(gid UUID) RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM group_members WHERE group_id = gid
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Trigger: auto-add group creator as admin on group creation
CREATE FUNCTION add_creator_as_admin() RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO group_members (group_id, user_id, role)
    VALUES (NEW.id, NEW.created_by, 'admin');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_group_creator_admin
    AFTER INSERT ON groups
    FOR EACH ROW
    EXECUTE FUNCTION add_creator_as_admin();

-- Join a group using an invite token
CREATE FUNCTION join_group_by_invite(invite_token TEXT)
RETURNS TABLE(group_id UUID, user_id UUID, role TEXT, joined_at TIMESTAMPTZ, already_member BOOLEAN) AS $$
DECLARE
    v_group_id UUID;
    v_already_member BOOLEAN;
BEGIN
    SELECT gi.group_id INTO v_group_id FROM group_invites gi WHERE gi.token = invite_token;

    IF v_group_id IS NULL THEN
        RAISE EXCEPTION 'Invalid invite token'
            USING ERRCODE = 'P0002';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM group_members gm
        WHERE gm.group_id = v_group_id AND gm.user_id = current_user_id()
    ) INTO v_already_member;

    IF NOT v_already_member THEN
        INSERT INTO group_members (group_id, user_id, role)
        VALUES (v_group_id, current_user_id(), 'member');
    END IF;

    RETURN QUERY
    SELECT gm.group_id, gm.user_id, gm.role, gm.joined_at, v_already_member
    FROM group_members gm
    WHERE gm.group_id = v_group_id AND gm.user_id = current_user_id();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION join_group_by_invite(TEXT) TO app_user;

-- RLS: groups
GRANT ALL PRIVILEGES ON TABLE groups TO app_user;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY groups_select ON groups FOR SELECT TO app_user
    USING (is_group_member(id) OR (created_by = current_user_id() AND NOT group_has_members(id)));
CREATE POLICY groups_insert ON groups FOR INSERT TO app_user
    WITH CHECK (true);
CREATE POLICY groups_update ON groups FOR UPDATE TO app_user
    USING (is_group_admin(id));
CREATE POLICY groups_delete ON groups FOR DELETE TO app_user
    USING (is_group_admin(id));

-- RLS: group_members
GRANT SELECT, DELETE ON group_members TO app_user;
GRANT UPDATE (role) ON group_members TO app_user;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY groups_members_select ON group_members FOR SELECT TO app_user
    USING (is_group_member(group_id));

CREATE POLICY group_members_update ON group_members FOR UPDATE TO app_user
    USING (is_group_admin(group_id))
    WITH CHECK (is_group_admin(group_id));

CREATE POLICY group_members_delete ON group_members FOR DELETE TO app_user
    USING (is_group_admin(group_id) AND user_id <> current_user_id());

-- No direct insert policy: members join via invite links (join_group_by_invite)
-- Group creator is added automatically by trigger (SECURITY DEFINER)

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
-- SECURITY DEFINER to bypass RLS on group_members
CREATE FUNCTION shares_group_with_current_user(uid UUID) RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM group_members gm1
        JOIN group_members gm2 ON gm1.group_id = gm2.group_id
        WHERE gm1.user_id = current_user_id()
          AND gm2.user_id = uid
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_select ON users FOR SELECT TO app_user
    USING (id = current_user_id() OR shares_group_with_current_user(id));

CREATE POLICY users_update ON users FOR UPDATE TO app_user
    USING (id = current_user_id());
