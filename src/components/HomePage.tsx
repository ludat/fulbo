import { useAuth } from "react-oidc-context";
import { LandingPage } from "./LandingPage";
import { GroupList } from "./groups/GroupList";
import { Navbar } from "./layout/Navbar";

export function HomePage() {
  const auth = useAuth();

  if (auth.isLoading) {
    return <div className="loading">Cargando...</div>;
  }

  if (!auth.isAuthenticated) {
    return <LandingPage />;
  }

  return (
    <div className="app-shell">
      <Navbar />
      <main className="main-content">
        <GroupList />
      </main>
    </div>
  );
}
