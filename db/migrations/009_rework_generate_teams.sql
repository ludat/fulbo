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
    v_total_players INT;
    v_max_per_team INT;
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

    -- Count total going players to enforce balanced team sizes
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

    v_max_per_team := ceil(v_total_players / 2.0);

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
        IF v_team1_count >= v_max_per_team THEN
            -- Team 1 is full, force to team 2
            v_diff1 := 1;
            v_diff2 := 0;
        ELSIF v_team2_count >= v_max_per_team THEN
            -- Team 2 is full, force to team 1
            v_diff1 := 0;
            v_diff2 := 1;
        ELSIF v_has_attrs THEN
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
