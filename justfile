set shell := ["nu", "-c"]

[group('db')]
db_reset: db_clear && db_start

[group('db')]
db_start:
    docker compose up -d db

[group('db')]
db_clear:
    docker compose down -v db

[group('db')]
db_migrate:
    docker compose run --rm migrate migrate

[group('db')]
db_schema: db_setup_schema
    docker compose run --rm schema apply --file main.sql --schema api --auto-approve

[group('db')]
db_schema_plan: db_setup_schema
    docker compose run --rm schema plan --file main.sql --schema api --output-sql /dev/stdout

[group('db')]
db_setup_schema:
    try { docker compose exec db psql -U authenticator -d fulbo -c 'create database pgschema_plan;' }

[group('postgrest')]
postgrest_restart:
    docker compose up --force-recreate postgrest -d

[group('postgrest')]
postgrest_reload:
    docker compose kill -s SIGUSR1 postgrest

[group('postgres')]
postgrest_update_jwks: && postgrest_reload
    #!/usr/bin/env nu
    let jwks_uri = http get 'http://localhost:8080/realms/fulbo/.well-known/openid-configuration' | get jwks_uri
    let certs = http get $jwks_uri | get keys
    $'PGRST_JWT_SECRET=($certs | where {$in.use == "sig"} | first | to json --raw)' | save -f postgrest.env.local
