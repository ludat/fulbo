
CREATE FUNCTION current_user_id() RETURNS UUID AS $$
    SELECT (current_setting('request.jwt.claims', true)::json->>'sub')::UUID;
$$ LANGUAGE sql STABLE;

ALTER DEFAULT PRIVILEGES IN SCHEMA api GRANT ALL PRIVILEGES ON TABLES TO app_user;
