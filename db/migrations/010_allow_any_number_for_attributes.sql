ALTER TABLE player_ratings DROP CONSTRAINT player_ratings_rating_check;

ALTER TABLE player_ratings
ADD CONSTRAINT player_ratings_rating_check CHECK (rating >= 0) NOT VALID;

ALTER TABLE player_ratings VALIDATE CONSTRAINT player_ratings_rating_check;
