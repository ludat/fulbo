import { AuthProvider as OidcAuthProvider, useAuth } from "react-oidc-context";
import { type ReactNode, useEffect } from "react";
import { WebStorageStateStore } from "oidc-client-ts";
import { config } from "../config";
import { faro } from "../faro";

const oidcConfig = {
  authority: config.oidcAuthority,
  client_id: config.oidcClientId,
  redirect_uri: window.location.origin + "/",
  post_logout_redirect_uri: window.location.origin + "/",
  scope: "openid profile email",
  response_type: "code",
  userStore: new WebStorageStateStore({ store: window.localStorage }),
  onSigninCallback: (): void => {
    window.history.replaceState({}, document.title, window.location.pathname);
  },
};

function FaroUserSync({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const profile = auth.user?.profile;

  useEffect(() => {
    if (!faro) return;
    if (profile) {
      faro.api.setUser({
        id: profile.sub,
        username: profile.name ?? undefined,
        email: profile.email ?? undefined,
      });
    } else {
      faro.api.resetUser();
    }
  }, [profile]);

  return children;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <OidcAuthProvider {...oidcConfig}>
      <FaroUserSync>{children}</FaroUserSync>
    </OidcAuthProvider>
  );
}
