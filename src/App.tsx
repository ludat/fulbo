import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "react-oidc-context";
import { useEffect, useMemo } from "react";
import { AppShell } from "./components/layout/AppShell";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { GroupList } from "./components/groups/GroupList";
import { GroupForm } from "./components/groups/GroupForm";
import { GroupEditForm } from "./components/groups/GroupEditForm";
import { GroupDetail } from "./components/groups/GroupDetail";
import { MatchForm } from "./components/matches/MatchForm";
import { MatchEditForm } from "./components/matches/MatchEditForm";
import { MatchDetail } from "./components/matches/MatchDetail";
import { PastMatches } from "./components/matches/PastMatches";
import { JoinByInvite } from "./components/groups/JoinByInvite";
import { setTokenGetter, rpc } from "./api/postgrest";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

function AppRoutes() {
  const auth = useAuth();

  useMemo(() => {
    setTokenGetter(() => auth.user?.access_token);
  }, [auth.user?.access_token]);

  // Sync user to DB after login
  useEffect(() => {
    if (auth.isAuthenticated && auth.user?.access_token) {
      rpc("ensure_user").catch(console.error);
    }
  }, [auth.isAuthenticated, auth.user?.access_token]);

  return (
    <Routes>
      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<GroupList />} />
        <Route path="groups/new" element={<GroupForm />} />
        <Route path="groups/:groupId" element={<GroupDetail />} />
        <Route path="groups/:groupId/edit" element={<GroupEditForm />} />
        <Route
          path="groups/:groupId/matches/new"
          element={<MatchForm />}
        />
        <Route
          path="groups/:groupId/matches/past"
          element={<PastMatches />}
        />
        <Route
          path="groups/:groupId/matches/:matchId"
          element={<MatchDetail />}
        />
        <Route
          path="groups/:groupId/matches/:matchId/edit"
          element={<MatchEditForm />}
        />
        <Route path="invite/:token" element={<JoinByInvite />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
