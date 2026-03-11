import { type ReactNode } from "react";
import { useAuth } from "react-oidc-context";
import { useLocation } from "react-router-dom";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const auth = useAuth();

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
    return <LoginRequired />;
  }

  return <>{children}</>;
}

function LoginRequired() {
  const auth = useAuth();
  const location = useLocation();

  const handleLogin = () => {
    sessionStorage.setItem(
      "fulbo_return_to",
      location.pathname + location.search + location.hash,
    );
    auth.signinRedirect();
  };

  return (
    <div className="login-required">
      <h2>Tenés que estar logueado para acceder a esta página</h2>
      <button className="btn btn-primary" onClick={handleLogin}>
        Iniciar sesión
      </button>
    </div>
  );
}
