import { AuthProvider as OidcAuthProvider } from "react-oidc-context";
import type { ReactNode } from "react";
import { WebStorageStateStore } from "oidc-client-ts";
import { config } from "../config";

const oidcConfig = {
  authority: config.oidcAuthority,
  client_id: config.oidcClientId,
  redirect_uri: window.location.origin + "/",
  post_logout_redirect_uri: window.location.origin + "/",
  scope: "openid profile email",
  response_type: "code",
  userStore: new WebStorageStateStore({ store: window.localStorage }),
};

export function AuthProvider({ children }: { children: ReactNode }) {
  return <OidcAuthProvider {...oidcConfig}>{children}</OidcAuthProvider>;
}
