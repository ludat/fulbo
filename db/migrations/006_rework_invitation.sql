DROP FUNCTION IF EXISTS join_group_by_invite(text);

CREATE OR REPLACE FUNCTION join_group_by_invite(
    invite_token text
)
RETURNS TABLE(group_id uuid, user_id uuid, role text, joined_at timestamptz, already_member boolean)
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
$$;
