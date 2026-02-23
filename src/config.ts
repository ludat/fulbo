const cfg = (window as unknown as Record<string, Record<string, string>>).__FULBO_CONFIG__ ?? {};

function resolve(value: string | undefined, placeholder: string, envVar: string | undefined, fallback: string): string {
  if (value && value !== placeholder) return value;
  return envVar ?? fallback;
}

export const config = {
  apiUrl: resolve(cfg.apiUrl, "__VITE_API_URL__", import.meta.env.VITE_API_URL, "http://localhost:3000"),
  oidcAuthority: resolve(cfg.oidcAuthority, "__VITE_OIDC_AUTHORITY__", import.meta.env.VITE_OIDC_AUTHORITY, "http://localhost:8080/fulbo"),
  oidcClientId: resolve(cfg.oidcClientId, "__VITE_OIDC_CLIENT_ID__", import.meta.env.VITE_OIDC_CLIENT_ID, "fulbo"),
};
