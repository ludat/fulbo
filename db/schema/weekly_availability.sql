CREATE TABLE weekly_availability (
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),  -- 0=Mon, 6=Sun
    time_slot SMALLINT NOT NULL CHECK (time_slot BETWEEN 0 AND 47),     -- 0=00:00, 1=00:30, ...
    PRIMARY KEY (group_id, player_id, day_of_week, time_slot)
);

GRANT ALL PRIVILEGES ON TABLE weekly_availability TO app_user;
ALTER TABLE weekly_availability ENABLE ROW LEVEL SECURITY;

-- Members can see all availability in their groups
CREATE POLICY weekly_availability_select ON weekly_availability FOR SELECT TO app_user
    USING (is_group_member(group_id));

-- Players can insert their own availability
CREATE POLICY weekly_availability_insert ON weekly_availability FOR INSERT TO app_user
    WITH CHECK (player_id = current_player_id(group_id));

-- Players can delete their own availability
CREATE POLICY weekly_availability_delete ON weekly_availability FOR DELETE TO app_user
    USING (player_id = current_player_id(group_id));
