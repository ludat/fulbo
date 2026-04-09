import { useAuth } from "react-oidc-context";
import { LandingPage } from "./LandingPage";
import { GroupList } from "./groups/GroupList";
import { Navbar } from "./layout/Navbar";

export function HomePage() {
  const auth = useAuth();

  if (auth.isLoading) {
    return (
      <div className="text-text-secondary p-8 text-center">Cargando...</div>
    );
  }

  if (!auth.isAuthenticated) {
    return <LandingPage />;
  }

  return (
    <div>
      <Navbar />
      <main className="mx-auto max-w-3xl p-6">
        <GroupList />
      </main>
    </div>
  );
}
