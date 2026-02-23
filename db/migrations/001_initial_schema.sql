---- tern: disable-tx ----
CREATE DATABASE pgschema_plan;

-- Schema
CREATE SCHEMA IF NOT EXISTS api;

-- Roles
-- CREATE ROLE authenticator NOINHERIT LOGIN PASSWORD 'authenticator';
CREATE ROLE anon NOLOGIN;
CREATE ROLE app_user NOLOGIN;

GRANT anon TO authenticator;
GRANT app_user TO authenticator;

GRANT USAGE ON SCHEMA api TO anon;
GRANT USAGE ON SCHEMA api TO app_user;
