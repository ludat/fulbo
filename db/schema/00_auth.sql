
CREATE FUNCTION current_user_id() RETURNS UUID AS $$
    SELECT (current_setting('request.jwt.claims', true)::json->>'sub')::UUID;
$$ LANGUAGE sql STABLE;
