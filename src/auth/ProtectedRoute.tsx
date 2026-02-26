import { type ReactNode } from "react";
import { useAutoSignin } from "react-oidc-context";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated, error } = useAutoSignin({
    signinMethod: "signinRedirect",
  });

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
