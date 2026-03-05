-- Randomly shuffle players into two equal teams
CREATE FUNCTION shuffle_teams(p_match_id UUID)
RETURNS TABLE(o_match_id UUID, o_player_id UUID, o_team INT) AS $$
DECLARE
    v_group_id UUID;
    v_total_players INT;
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

    -- Count total going players
    SELECT count(*) INTO v_total_players
    FROM attendance a
    WHERE a.match_id = p_match_id AND a.status = 'going';

    IF v_total_players < 2 THEN
        RAISE EXCEPTION 'Se necesitan al menos 2 jugadores confirmados para generar equipos'
            USING ERRCODE = 'P0004';
    END IF;

    IF v_total_players % 2 != 0 THEN
        RAISE EXCEPTION 'Se necesita un número par de jugadores para generar equipos (hay %)', v_total_players
            USING ERRCODE = 'P0004';
    END IF;

    -- Delete existing team assignments
    DELETE FROM match_teams mt WHERE mt.match_id = p_match_id;

    -- Randomly assign players: shuffle with random(), first half to team 1, rest to team 2
    INSERT INTO match_teams (match_id, player_id, team)
    SELECT p_match_id, sub.player_id,
           CASE WHEN sub.rn <= v_total_players / 2 THEN 1 ELSE 2 END
    FROM (
        SELECT a.player_id, row_number() OVER (ORDER BY random()) AS rn
        FROM attendance a
        WHERE a.match_id = p_match_id AND a.status = 'going'
    ) sub;

    RETURN QUERY SELECT mt.match_id, mt.player_id, mt.team FROM match_teams mt WHERE mt.match_id = p_match_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION shuffle_teams(UUID) TO app_user;
