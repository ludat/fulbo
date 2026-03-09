CREATE VIEW player_vote_averages
WITH (security_barrier = true) AS
SELECT
    group_id,
    player_id,
    attribute_id,
    avg(rating)::NUMERIC(5,2) AS avg_rating,
    count(*) AS vote_count
FROM player_attribute_votes
GROUP BY group_id, player_id, attribute_id
HAVING is_group_member(group_id);

GRANT SELECT ON player_vote_averages TO app_user;
