import { type ReactNode, useEffect } from "react";
import { useAuth } from "react-oidc-context";
import { useNavigate, useLocation } from "react-router-dom";
import { LandingPage } from "../components/LandingPage";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // After login completes, navigate to the saved URL via React Router.
  useEffect(() => {
    if (auth.isAuthenticated) {
      const returnTo = sessionStorage.getItem("fulbo_return_to");
      sessionStorage.removeItem("fulbo_return_to");
      const currentUrl =
        location.pathname + location.search + location.hash;
      if (returnTo && returnTo !== currentUrl) {
        navigate(returnTo, { replace: true });
      }
    }
  }, [auth.isAuthenticated, navigate, location.pathname, location.search, location.hash]);

  if (auth.isLoading) {
    return <div className="loading">Cargando...</div>;
  }

  if (auth.error) {
    return (
      <div>
        <p>Ocurrio un error</p>
        <pre>{JSON.stringify(auth.error, null, 2)}</pre>
      </div>
    );
  }

  if (!auth.isAuthenticated) {
    return <LandingPage />;
  }

  return <>{children}</>;
}
