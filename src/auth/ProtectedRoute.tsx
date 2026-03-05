import { type ReactNode, useEffect } from "react";
import { useAutoSignin } from "react-oidc-context";
import { useNavigate, useLocation } from "react-router-dom";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated, error } = useAutoSignin({
    signinMethod: "signinRedirect",
  });

  const navigate = useNavigate();
  const location = useLocation();

  // Save the current URL before OIDC redirects to Keycloak.
  // Only when unauthenticated and not processing the callback (code= in URL).
  if (!isAuthenticated && !window.location.search.includes("code=")) {
    sessionStorage.setItem(
      "fulbo_return_to",
      window.location.pathname + window.location.search + window.location.hash,
    );
  }

  // After login completes, navigate to the saved URL via React Router.
  useEffect(() => {
    if (isAuthenticated) {
      const returnTo = sessionStorage.getItem("fulbo_return_to");
      sessionStorage.removeItem("fulbo_return_to");
      const currentUrl =
        location.pathname + location.search + location.hash;
      if (returnTo && returnTo !== currentUrl) {
        navigate(returnTo, { replace: true });
      }
    }
  }, [isAuthenticated, navigate, location.pathname, location.search, location.hash]);

  if (isLoading) {
    return <div className="loading">Iniciando sesion...</div>;
  }

  if (!isAuthenticated) {
    return (
      <div>
        <p>No se pudo iniciar sesion</p>
        <pre>{JSON.stringify(error, null, 2)}</pre>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <p>Ocurrio un error</p>
        <pre>{JSON.stringify(error, null, 2)}</pre>
      </div>
    );
  }

  // return <div>Signed in successfully</div>;
  return <>{children}</>;
}
