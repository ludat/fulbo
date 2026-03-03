REVOKE UPDATE (role) ON TABLE group_members FROM app_user;

CREATE TABLE IF NOT EXISTS player_attributes (
    id uuid DEFAULT gen_random_uuid(),
    group_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    abbreviation text,
    display_order integer DEFAULT 0 NOT NULL,
    CONSTRAINT player_attributes_pkey PRIMARY KEY (id),
    CONSTRAINT player_attributes_group_id_name_key UNIQUE (group_id, name),
    CONSTRAINT player_attributes_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups (id) ON DELETE CASCADE,
    CONSTRAINT player_attributes_abbreviation_check CHECK (length(abbreviation) <= 3)
);

ALTER TABLE player_attributes ENABLE ROW LEVEL SECURITY;

CREATE POLICY player_attributes_delete ON player_attributes FOR DELETE TO app_user USING (is_group_admin(group_id));

CREATE POLICY player_attributes_insert ON player_attributes FOR INSERT TO app_user WITH CHECK (is_group_admin(group_id));

CREATE POLICY player_attributes_select ON player_attributes FOR SELECT TO app_user USING (is_group_admin(group_id));

CREATE POLICY player_attributes_update ON player_attributes FOR UPDATE TO app_user USING (is_group_admin(group_id));

CREATE TABLE IF NOT EXISTS players (
    id uuid DEFAULT gen_random_uuid(),
    group_id uuid NOT NULL,
    user_id uuid,
    name text NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT players_pkey PRIMARY KEY (id),
    CONSTRAINT players_group_id_name_key UNIQUE (group_id, name),
    CONSTRAINT players_group_id_user_id_key UNIQUE (group_id, user_id),
    CONSTRAINT players_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups (id) ON DELETE CASCADE
);

ALTER TABLE players ENABLE ROW LEVEL SECURITY;

CREATE POLICY players_delete ON players FOR DELETE TO app_user USING (is_group_admin(group_id));

CREATE POLICY players_insert ON players FOR INSERT TO app_user WITH CHECK (is_group_admin(group_id) OR (is_group_member(group_id) AND (user_id = current_user_id())));

CREATE POLICY players_select ON players FOR SELECT TO app_user USING (is_group_admin(group_id) OR is_group_member(group_id));

CREATE POLICY players_update ON players FOR UPDATE TO app_user USING (is_group_admin(group_id) OR (user_id = current_user_id()));

CREATE TABLE IF NOT EXISTS match_teams (
    match_id uuid,
    player_id uuid,
    team integer NOT NULL,
    CONSTRAINT match_teams_pkey PRIMARY KEY (match_id, player_id),
    CONSTRAINT match_teams_player_id_fkey FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE,
    CONSTRAINT match_teams_team_check CHECK (team IN (1, 2))
);

ALTER TABLE match_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY match_teams_delete ON match_teams FOR DELETE TO app_user USING (is_group_admin(( SELECT matches.group_id FROM matches WHERE (matches.id = match_teams.match_id))));

CREATE POLICY match_teams_insert ON match_teams FOR INSERT TO app_user WITH CHECK (is_group_admin(( SELECT matches.group_id FROM matches WHERE (matches.id = match_teams.match_id))));

CREATE POLICY match_teams_select ON match_teams FOR SELECT TO app_user USING (is_group_member(( SELECT matches.group_id FROM matches WHERE (matches.id = match_teams.match_id))));

CREATE POLICY match_teams_update ON match_teams FOR UPDATE TO app_user USING (is_group_admin(( SELECT matches.group_id FROM matches WHERE (matches.id = match_teams.match_id))));

CREATE TABLE IF NOT EXISTS player_ratings (
    group_id uuid,
    player_id uuid,
    attribute_id uuid,
    rating integer NOT NULL,
    CONSTRAINT player_ratings_pkey PRIMARY KEY (group_id, player_id, attribute_id),
    CONSTRAINT player_ratings_attribute_id_fkey FOREIGN KEY (attribute_id) REFERENCES player_attributes (id) ON DELETE CASCADE,
    CONSTRAINT player_ratings_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups (id) ON DELETE CASCADE,
    CONSTRAINT player_ratings_player_id_fkey FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE,
    CONSTRAINT player_ratings_rating_check CHECK (rating >= 1 AND rating <= 10)
);

ALTER TABLE player_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY player_ratings_delete ON player_ratings FOR DELETE TO app_user USING (is_group_admin(group_id));

CREATE POLICY player_ratings_insert ON player_ratings FOR INSERT TO app_user WITH CHECK (is_group_admin(group_id));

CREATE POLICY player_ratings_select ON player_ratings FOR SELECT TO app_user USING (is_group_member(group_id));

CREATE POLICY player_ratings_update ON player_ratings FOR UPDATE TO app_user USING (is_group_admin(group_id));

CREATE OR REPLACE FUNCTION complete_join_by_invite(
    invite_token text,
    p_player_id uuid DEFAULT NULL,
    p_name text DEFAULT NULL
)
RETURNS players
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
AS $$
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
$$;

CREATE OR REPLACE FUNCTION current_player_id(
    gid uuid
)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT id FROM players WHERE group_id = gid AND user_id = current_user_id();
$$;

CREATE OR REPLACE FUNCTION generate_teams(
    p_match_id uuid
)
RETURNS TABLE(o_match_id uuid, o_player_id uuid, o_team integer)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
AS $$
DECLARE
    v_group_id UUID;
    v_player RECORD;
    v_team1_count INT := 0;
    v_team2_count INT := 0;
    v_diff1 NUMERIC;
    v_diff2 NUMERIC;
    v_has_attrs BOOLEAN;
BEGIN
    -- Get the group for this match
    SELECT m.group_id INTO v_group_id FROM matches m WHERE m.id = p_match_id;
    IF v_group_id IS NULL THEN
        RAISE EXCEPTION 'Match not found' USING ERRCODE = 'P0002';
    END IF;

    -- Check admin permission
    IF NOT is_group_admin(v_group_id) THEN
        RAISE EXCEPTION 'Only admins can generate teams' USING ERRCODE = 'P0003';
    END IF;

    SELECT EXISTS (SELECT 1 FROM player_attributes sa WHERE sa.group_id = v_group_id) INTO v_has_attrs;

    -- Temp table to track per-axis sums for each team
    CREATE TEMP TABLE IF NOT EXISTS _team_attr_sums (
        attribute_id UUID NOT NULL,
        team1_sum NUMERIC NOT NULL DEFAULT 0,
        team2_sum NUMERIC NOT NULL DEFAULT 0
    );
    DELETE FROM _team_attr_sums;

    IF v_has_attrs THEN
        INSERT INTO _team_attr_sums (attribute_id)
        SELECT sa.id FROM player_attributes sa WHERE sa.group_id = v_group_id;
    END IF;

    -- Delete existing team assignments
    DELETE FROM match_teams mt WHERE mt.match_id = p_match_id;

    -- Process players sorted by total rating descending
    FOR v_player IN
        SELECT a.player_id,
               coalesce(sum(pr.rating), 0) AS total_rating
        FROM attendance a
        LEFT JOIN player_ratings pr ON pr.player_id = a.player_id AND pr.group_id = v_group_id
        WHERE a.match_id = p_match_id AND a.status = 'going'
        GROUP BY a.player_id
        ORDER BY coalesce(sum(pr.rating), 0) DESC
    LOOP
        IF v_has_attrs THEN
            -- Sum of squared axis differences if player goes to team 1
            SELECT coalesce(sum(power(
                (tas.team1_sum + coalesce(pr.rating, 0)) - tas.team2_sum, 2
            )), 0)
            INTO v_diff1
            FROM _team_attr_sums tas
            LEFT JOIN player_ratings pr ON pr.attribute_id = tas.attribute_id
                AND pr.player_id = v_player.player_id AND pr.group_id = v_group_id;

            -- Sum of squared axis differences if player goes to team 2
            SELECT coalesce(sum(power(
                tas.team1_sum - (tas.team2_sum + coalesce(pr.rating, 0)), 2
            )), 0)
            INTO v_diff2
            FROM _team_attr_sums tas
            LEFT JOIN player_ratings pr ON pr.attribute_id = tas.attribute_id
                AND pr.player_id = v_player.player_id AND pr.group_id = v_group_id;
        ELSE
            -- No axes: balance by count only
            v_diff1 := power(v_team1_count + 1 - v_team2_count, 2);
            v_diff2 := power(v_team1_count - (v_team2_count + 1), 2);
        END IF;

        -- Assign to team that minimizes imbalance (prefer smaller team on tie)
        IF v_diff1 < v_diff2 OR (v_diff1 = v_diff2 AND v_team1_count <= v_team2_count) THEN
            INSERT INTO match_teams (match_id, player_id, team) VALUES (p_match_id, v_player.player_id, 1);
            v_team1_count := v_team1_count + 1;
            IF v_has_attrs THEN
                UPDATE _team_attr_sums tas
                SET team1_sum = tas.team1_sum + coalesce(sub.rating, 0)
                FROM (
                    SELECT tas2.attribute_id, pr2.rating
                    FROM _team_attr_sums tas2
                    LEFT JOIN player_ratings pr2 ON pr2.attribute_id = tas2.attribute_id
                        AND pr2.player_id = v_player.player_id AND pr2.group_id = v_group_id
                ) sub
                WHERE tas.attribute_id = sub.attribute_id;
            END IF;
        ELSE
            INSERT INTO match_teams (match_id, player_id, team) VALUES (p_match_id, v_player.player_id, 2);
            v_team2_count := v_team2_count + 1;
            IF v_has_attrs THEN
                UPDATE _team_attr_sums tas
                SET team2_sum = tas.team2_sum + coalesce(sub.rating, 0)
                FROM (
                    SELECT tas2.attribute_id, pr2.rating
                    FROM _team_attr_sums tas2
                    LEFT JOIN player_ratings pr2 ON pr2.attribute_id = tas2.attribute_id
                        AND pr2.player_id = v_player.player_id AND pr2.group_id = v_group_id
                ) sub
                WHERE tas.attribute_id = sub.attribute_id;
            END IF;
        END IF;
    END LOOP;

    DROP TABLE IF EXISTS _team_attr_sums;

    RETURN QUERY SELECT mt.match_id, mt.player_id, mt.team FROM match_teams mt WHERE mt.match_id = p_match_id;
END;
$$;

CREATE OR REPLACE FUNCTION unlinked_players_for_invite(
    invite_token text
)
RETURNS TABLE(id uuid, name text)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
AS $$
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
$$;

ALTER TABLE players
ADD CONSTRAINT players_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL;

ALTER TABLE match_teams
ADD CONSTRAINT match_teams_match_id_fkey FOREIGN KEY (match_id) REFERENCES matches (id) ON DELETE CASCADE;

ALTER TABLE attendance DROP CONSTRAINT attendance_user_id_fkey;

ALTER TABLE attendance
ADD COLUMN player_id uuid NOT NULL CONSTRAINT attendance_player_id_fkey REFERENCES players (id) ON DELETE CASCADE;

-- Migrate attendance from user_id to player_id
UPDATE attendance a
SET player_id = p.id
FROM matches m, players p
WHERE m.id = a.match_id
  AND p.group_id = m.group_id
  AND p.user_id = a.user_id;

ALTER POLICY attendance_delete ON attendance USING ((player_id = current_player_id(( SELECT matches.group_id FROM matches WHERE (matches.id = attendance.match_id)))) OR is_group_admin(( SELECT matches.group_id FROM matches WHERE (matches.id = attendance.match_id))));

ALTER POLICY attendance_insert ON attendance WITH CHECK ((player_id = current_player_id(( SELECT matches.group_id FROM matches WHERE (matches.id = attendance.match_id)))) OR is_group_admin(( SELECT matches.group_id FROM matches WHERE (matches.id = attendance.match_id))));

ALTER POLICY attendance_update ON attendance USING ((player_id = current_player_id(( SELECT matches.group_id FROM matches WHERE (matches.id = attendance.match_id)))) OR is_group_admin(( SELECT matches.group_id FROM matches WHERE (matches.id = attendance.match_id))));

ALTER TABLE attendance DROP COLUMN user_id;

ALTER TABLE attendance
ADD CONSTRAINT attendance_pkey PRIMARY KEY (match_id, player_id);

ALTER TABLE group_members ALTER COLUMN role SET DEFAULT 'admin';

ALTER TABLE group_members DROP CONSTRAINT group_members_role_check;

-- Migrate all group_members to players
INSERT INTO players (group_id, user_id, name)
SELECT gm.group_id, gm.user_id,
  COALESCE(u.display_name, 'Player') || '-' || left(gen_random_uuid()::text, 8)
FROM group_members gm
JOIN users u ON u.id = gm.user_id;

-- Remove non-admin rows (now redundant, membership is in players)
DELETE FROM group_members WHERE role = 'member';

ALTER TABLE group_members
ADD CONSTRAINT group_members_role_check CHECK (role = 'admin'::text) NOT VALID;

ALTER TABLE group_members VALIDATE CONSTRAINT group_members_role_check;

DROP POLICY IF EXISTS group_members_update ON group_members;

CREATE POLICY group_members_insert ON group_members FOR INSERT TO app_user WITH CHECK (is_group_admin(group_id));

ALTER POLICY groups_members_select ON group_members USING (is_group_member(group_id) OR is_group_admin(group_id));

ALTER POLICY groups_select ON groups USING (is_group_member(id) OR is_group_admin(id) OR ((created_by = current_user_id()) AND (NOT group_has_members(id))));

CREATE OR REPLACE FUNCTION add_creator_as_admin()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
AS $$
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
        SELECT 1 FROM players WHERE group_id = gid
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
        SELECT 1 FROM players
        WHERE group_id = gid
          AND user_id = current_user_id()
    );
$$;

DROP FUNCTION IF EXISTS join_group_by_invite(text);

CREATE OR REPLACE FUNCTION join_group_by_invite(
    invite_token text
)
RETURNS TABLE(group_id uuid, user_id uuid, already_member boolean)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
AS $$
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
        SELECT 1 FROM players p1
        JOIN players p2 ON p1.group_id = p2.group_id
        WHERE p1.user_id = current_user_id()
          AND p2.user_id = uid
    );
$$;

GRANT INSERT ON TABLE group_members TO app_user;

GRANT EXECUTE ON FUNCTION complete_join_by_invite(invite_token text, p_player_id uuid, p_name text) TO app_user;

GRANT EXECUTE ON FUNCTION current_player_id(gid uuid) TO app_user;

GRANT EXECUTE ON FUNCTION generate_teams(p_match_id uuid) TO app_user;

GRANT EXECUTE ON FUNCTION join_group_by_invite(invite_token text) TO app_user;

GRANT EXECUTE ON FUNCTION unlinked_players_for_invite(invite_token text) TO app_user;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE match_teams TO app_user;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE player_attributes TO app_user;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE player_ratings TO app_user;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE players TO app_user;
