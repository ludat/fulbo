import { useAuth } from "react-oidc-context";
import { Link } from "react-router-dom";

export function Navbar() {
  const auth = useAuth();
  const user = auth.user?.profile;

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        Fulbo
      </Link>
      <div className="navbar-right">
        {user && (
          <>
            <span className="navbar-user">
              {user.picture && (
                <img
                  src={user.picture as string}
                  alt=""
                  className="navbar-avatar"
                />
              )}
              {user.name ?? user.email}
            </span>
            <button
              className="btn btn-secondary"
              onClick={() => auth.signoutRedirect()}
            >
              Cerrar sesion
            </button>
          </>
        )}
      </div>
    </nav>
  );
}
