# Fulbo

Soccer match scheduling app. Create groups, schedule matches, RSVP.

## Tech Stack

- **Frontend**: React + Vite + TypeScript
- **Backend**: Postgres 18 + PostgREST v14.5 (zero application code, just SQL)
- **Auth**: OIDC/PKCE via `react-oidc-context` + `oidc-client-ts` using Keycloak (delegates to Google).

## Running Locally

```sh
docker compose up -d
npm run dev
```

- App: http://localhost:5173
- PostgREST API: http://localhost:3000
- Keycloak: http://localhost:8080
- pgAdmin: http://localhost:5050
