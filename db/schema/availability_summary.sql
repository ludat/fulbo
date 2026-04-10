CREATE VIEW availability_summary
WITH (security_barrier = true) AS
SELECT
    wa.group_id,
    wa.day_of_week,
    wa.time_slot,
    count(*)::integer AS player_count,
    array_agg(p.name ORDER BY p.name) AS player_names
FROM weekly_availability wa
JOIN players p ON p.id = wa.player_id
GROUP BY wa.group_id, wa.day_of_week, wa.time_slot
HAVING is_group_member(wa.group_id);

GRANT SELECT ON availability_summary TO app_user;
