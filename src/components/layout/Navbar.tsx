import { useAuth } from "react-oidc-context";
import { Link } from "react-router-dom";
import { Button } from "../ui/Button";

export function Navbar() {
  const auth = useAuth();
  const user = auth.user?.profile;

  return (
    <nav className="bg-primary flex items-center justify-between px-6 py-3 text-white">
      <Link to="/" className="text-xl font-bold text-white no-underline">
        Fulbo
      </Link>
      <div className="flex items-center gap-4">
        {user && (
          <>
            <span className="flex items-center gap-2 text-sm">
              {user.picture && (
                <img
                  src={user.picture as string}
                  alt=""
                  className="h-6 w-6 rounded-full"
                />
              )}
              {user.name ?? user.email}
            </span>
            <Button variant="secondary" onClick={() => auth.signoutRedirect()}>
              Cerrar sesion
            </Button>
          </>
        )}
      </div>
    </nav>
  );
}
