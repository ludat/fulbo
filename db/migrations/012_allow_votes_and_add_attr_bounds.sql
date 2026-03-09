CREATE TABLE IF NOT EXISTS player_attribute_votes (
    group_id uuid,
    player_id uuid,
    attribute_id uuid,
    voter_id uuid,
    rating integer NOT NULL,
    CONSTRAINT player_attribute_votes_pkey PRIMARY KEY (group_id, player_id, attribute_id, voter_id),
    CONSTRAINT player_attribute_votes_attribute_id_fkey FOREIGN KEY (attribute_id) REFERENCES player_attributes (id) ON DELETE CASCADE
);

ALTER TABLE player_attribute_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY player_attribute_votes_delete ON player_attribute_votes FOR DELETE TO app_user USING (is_group_member(group_id) AND (voter_id = current_user_id()));

CREATE POLICY player_attribute_votes_insert ON player_attribute_votes FOR INSERT TO app_user WITH CHECK (is_group_member(group_id) AND (voter_id = current_user_id()) AND (player_id <> current_player_id(group_id)));

CREATE POLICY player_attribute_votes_select ON player_attribute_votes FOR SELECT TO app_user USING ((is_group_member(group_id) AND (voter_id = current_user_id())) OR is_group_admin(group_id));

CREATE POLICY player_attribute_votes_update ON player_attribute_votes FOR UPDATE TO app_user USING (is_group_member(group_id) AND (voter_id = current_user_id()));

ALTER TABLE player_attribute_votes
ADD CONSTRAINT player_attribute_votes_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups (id) ON DELETE CASCADE;

ALTER TABLE player_attribute_votes
ADD CONSTRAINT player_attribute_votes_player_id_fkey FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE;

ALTER TABLE player_attribute_votes
ADD CONSTRAINT player_attribute_votes_voter_id_fkey FOREIGN KEY (voter_id) REFERENCES users (id) ON DELETE CASCADE;

CREATE OR REPLACE VIEW player_vote_averages AS
 SELECT group_id,
    player_id,
    attribute_id,
    avg(rating)::numeric(5,2) AS avg_rating,
    count(*) AS vote_count
   FROM player_attribute_votes
  GROUP BY group_id, player_id, attribute_id
 HAVING is_group_member(group_id);

ALTER TABLE player_attributes ADD COLUMN min_rating integer DEFAULT 0 NOT NULL;

ALTER TABLE player_attributes ADD COLUMN max_rating integer DEFAULT 10 NOT NULL;

ALTER TABLE player_attributes
ADD CONSTRAINT player_attributes_check CHECK (min_rating < max_rating) NOT VALID;

ALTER TABLE player_attributes VALIDATE CONSTRAINT player_attributes_check;

ALTER POLICY player_attributes_select ON player_attributes USING (is_group_member(group_id));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE player_attribute_votes TO app_user;

GRANT SELECT ON TABLE player_vote_averages TO app_user;
