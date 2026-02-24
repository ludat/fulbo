CREATE TABLE IF NOT EXISTS users (
    id uuid,
    display_name text NOT NULL,
    email text NOT NULL,
    avatar_url text,
    created_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT users_pkey PRIMARY KEY (id),
    CONSTRAINT users_email_key UNIQUE (email)
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS group_members (
    group_id uuid,
    user_id uuid,
    role text DEFAULT 'member' NOT NULL,
    joined_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT group_members_pkey PRIMARY KEY (group_id, user_id),
    CONSTRAINT group_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT group_members_role_check CHECK (role IN ('admin'::text, 'member'::text))
);

ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS attendance (
    match_id uuid,
    user_id uuid,
    status text NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT attendance_pkey PRIMARY KEY (match_id, user_id),
    CONSTRAINT attendance_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT attendance_status_check CHECK (status IN ('going'::text, 'not_going'::text, 'maybe'::text))
);

ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION add_creator_as_admin()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO group_members (group_id, user_id, role)
    VALUES (NEW.id, NEW.created_by, 'admin');
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
    SELECT (current_setting('request.jwt.claims', true)::json->>'sub')::UUID;
$$;

CREATE OR REPLACE FUNCTION ensure_user()
RETURNS users
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
AS $$
DECLARE
    claims json := current_setting('request.jwt.claims', true)::json;
    uid UUID := (claims->>'sub')::UUID;
    uname TEXT := COALESCE(claims->>'name', 'User ' || left(claims->>'sub', 8));
    uemail TEXT := COALESCE(claims->>'email', (claims->>'sub') || '@local');
    uavatar TEXT := claims->>'picture';
    result users;
BEGIN
    INSERT INTO users (id, display_name, email, avatar_url)
    VALUES (uid, COALESCE(uname, uemail), uemail, uavatar)
    ON CONFLICT (id) DO UPDATE SET
        display_name = COALESCE(EXCLUDED.display_name, users.display_name),
        email = COALESCE(EXCLUDED.email, users.email),
        avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url)
    RETURNING * INTO result;

    RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION group_has_members(
    gid uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM group_members WHERE group_id = gid
    );
$$;

CREATE OR REPLACE FUNCTION is_group_admin(
    gid uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM group_members
        WHERE group_id = gid
          AND user_id = current_user_id()
          AND role = 'admin'
    );
$$;

CREATE OR REPLACE FUNCTION is_group_member(
    gid uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM group_members
        WHERE group_id = gid
          AND user_id = current_user_id()
    );
$$;

CREATE OR REPLACE FUNCTION join_group_by_invite(
    invite_token text
)
RETURNS SETOF api.group_members
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM group_invites WHERE token = invite_token) THEN
        RAISE EXCEPTION 'Invalid invite token'
            USING ERRCODE = 'P0002';
    END IF;

    RETURN QUERY
    INSERT INTO group_members (group_id, user_id, role)
    SELECT gi.group_id, current_user_id(), 'member'
    FROM group_invites gi WHERE gi.token = invite_token
    ON CONFLICT (group_id, user_id) DO NOTHING
    RETURNING *;
END;
$$;

CREATE OR REPLACE FUNCTION shares_group_with_current_user(
    uid uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM group_members gm1
        JOIN group_members gm2 ON gm1.group_id = gm2.group_id
        WHERE gm1.user_id = current_user_id()
          AND gm2.user_id = uid
    );
$$;

CREATE TABLE IF NOT EXISTS groups (
    id uuid DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    created_by uuid DEFAULT current_user_id() NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT groups_pkey PRIMARY KEY (id)
);

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY groups_insert ON groups FOR INSERT TO app_user WITH CHECK (true);

CREATE TABLE IF NOT EXISTS group_invites (
    id uuid DEFAULT gen_random_uuid(),
    group_id uuid NOT NULL,
    token text DEFAULT replace((gen_random_uuid())::text, '-', '') NOT NULL,
    created_by uuid DEFAULT current_user_id() NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT group_invites_pkey PRIMARY KEY (id),
    CONSTRAINT group_invites_token_key UNIQUE (token),
    CONSTRAINT group_invites_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups (id) ON DELETE CASCADE
);

ALTER TABLE group_invites ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS matches (
    id uuid DEFAULT gen_random_uuid(),
    group_id uuid NOT NULL,
    location text,
    starts_at timestamptz NOT NULL,
    notes text,
    created_by uuid DEFAULT current_user_id() NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT matches_pkey PRIMARY KEY (id),
    CONSTRAINT matches_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups (id) ON DELETE CASCADE
);

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

ALTER TABLE group_members
ADD CONSTRAINT group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups (id) ON DELETE CASCADE;

ALTER TABLE attendance
ADD CONSTRAINT attendance_match_id_fkey FOREIGN KEY (match_id) REFERENCES matches (id) ON DELETE CASCADE;

ALTER TABLE groups
ADD CONSTRAINT groups_created_by_fkey FOREIGN KEY (created_by) REFERENCES users (id);

ALTER TABLE group_invites
ADD CONSTRAINT group_invites_created_by_fkey FOREIGN KEY (created_by) REFERENCES users (id);

ALTER TABLE matches
ADD CONSTRAINT matches_created_by_fkey FOREIGN KEY (created_by) REFERENCES users (id);

CREATE POLICY attendance_delete ON attendance FOR DELETE TO app_user USING ((user_id = current_user_id()) OR is_group_admin(( SELECT matches.group_id FROM matches WHERE (matches.id = attendance.match_id))));

CREATE POLICY attendance_insert ON attendance FOR INSERT TO app_user WITH CHECK ((user_id = current_user_id()) OR is_group_admin(( SELECT matches.group_id FROM matches WHERE (matches.id = attendance.match_id))));

CREATE POLICY attendance_select ON attendance FOR SELECT TO app_user USING (is_group_member(( SELECT matches.group_id FROM matches WHERE (matches.id = attendance.match_id))));

CREATE POLICY attendance_update ON attendance FOR UPDATE TO app_user USING ((user_id = current_user_id()) OR is_group_admin(( SELECT matches.group_id FROM matches WHERE (matches.id = attendance.match_id))));

CREATE POLICY group_invites_delete ON group_invites FOR DELETE TO app_user USING (is_group_admin(group_id));

CREATE POLICY group_invites_insert ON group_invites FOR INSERT TO app_user WITH CHECK (is_group_admin(group_id));

CREATE POLICY group_invites_select ON group_invites FOR SELECT TO app_user USING (is_group_admin(group_id));

CREATE POLICY groups_delete ON groups FOR DELETE TO app_user USING (is_group_admin(id));

CREATE POLICY groups_members_select ON group_members FOR SELECT TO app_user USING (is_group_member(group_id));

CREATE POLICY groups_select ON groups FOR SELECT TO app_user USING (is_group_member(id) OR ((created_by = current_user_id()) AND (NOT group_has_members(id))));

CREATE POLICY groups_update ON groups FOR UPDATE TO app_user USING (is_group_admin(id));

CREATE POLICY matches_delete ON matches FOR DELETE TO app_user USING (is_group_admin(group_id));

CREATE POLICY matches_insert ON matches FOR INSERT TO app_user WITH CHECK (is_group_admin(group_id));

CREATE POLICY matches_select ON matches FOR SELECT TO app_user USING (is_group_member(group_id));

CREATE POLICY matches_update ON matches FOR UPDATE TO app_user USING (is_group_admin(group_id));

CREATE POLICY users_select ON users FOR SELECT TO app_user USING ((id = current_user_id()) OR shares_group_with_current_user(id));

CREATE POLICY users_update ON users FOR UPDATE TO app_user USING (id = current_user_id());

CREATE OR REPLACE TRIGGER trg_group_creator_admin
    AFTER INSERT ON groups
    FOR EACH ROW
    EXECUTE FUNCTION add_creator_as_admin();

GRANT EXECUTE ON FUNCTION ensure_user() TO app_user;

GRANT EXECUTE ON FUNCTION join_group_by_invite(invite_token text) TO app_user;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE attendance TO app_user;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE group_invites TO app_user;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE group_members TO app_user;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE groups TO app_user;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE matches TO app_user;

GRANT SELECT, UPDATE ON TABLE users TO app_user;
