CREATE TABLE users (
    id UUID PRIMARY KEY,
    display_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ensure_user: upserts user record from JWT claims after login
CREATE OR REPLACE FUNCTION ensure_user() RETURNS users AS $$
DECLARE
    claims json := current_setting('request.jwt.claims', true)::json;
    uid UUID := (claims->>'sub')::UUID;
    uname TEXT := COALESCE(claims->>'name', 'User ' || left(claims->>'sub', 8));
    uemail TEXT := COALESCE(claims->>'email', (claims->>'sub') || '@local');
    uavatar TEXT := claims->>'picture';
    result users;
BEGIN
    INSERT INTO users (id, display_name, email, avatar_url)
    VALUES (uid, COALESCE(uname, uemail), uemail, uavatar)
    ON CONFLICT (id) DO UPDATE SET
        display_name = COALESCE(EXCLUDED.display_name, users.display_name),
        email = COALESCE(EXCLUDED.email, users.email),
        avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url)
    RETURNING * INTO result;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION ensure_user() TO app_user;
