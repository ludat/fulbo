import { type ReactNode } from "react";
import { useAuth } from "react-oidc-context";
import { useLocation } from "react-router-dom";
import { Button } from "../components/ui/Button";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const auth = useAuth();

  if (auth.isLoading) {
    return (
      <div className="text-text-secondary p-8 text-center">Cargando...</div>
    );
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
    <div className="px-6 py-16 text-center">
      <h2 className="text-text-secondary mb-6 text-xl font-medium">
        Tenés que estar logueado para acceder a esta página
      </h2>
      <Button onClick={handleLogin}>Iniciar sesión</Button>
    </div>
  );
}
