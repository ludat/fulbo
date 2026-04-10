import { BrowserRouter, Route } from "react-router-dom";
import { FaroErrorBoundary, FaroRoutes } from "@grafana/faro-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "react-oidc-context";
import { useEffect, useMemo } from "react";
import { AppShell } from "./components/layout/AppShell";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { HomePage } from "./components/HomePage";
import { GroupForm } from "./components/groups/GroupForm";
import { GroupEditForm } from "./components/groups/GroupEditForm";
import { GroupDetail } from "./components/groups/GroupDetail";
import { GroupMembers } from "./components/groups/GroupMembers";
import { GroupRatings } from "./components/groups/GroupRatings";
import { GroupSettings } from "./components/groups/GroupSettings";
import { MatchForm } from "./components/matches/MatchForm";
import { MatchDetail } from "./components/matches/MatchDetail";
import { MatchPlayers } from "./components/matches/MatchPlayers";
import { MatchTeams } from "./components/matches/MatchTeams";
import { PastMatches } from "./components/matches/PastMatches";
import { JoinByInvite } from "./components/groups/JoinByInvite";
import { AttributesEditor } from "./components/groups/AttributesEditor";
import { PlayerRatings } from "./components/groups/PlayerRatings";
import { PlayerVoting } from "./components/groups/PlayerVoting";
import { WeeklyAvailability } from "./components/groups/WeeklyAvailability";
import { setTokenGetter, rpc } from "./api/postgrest";
import { useReturnToRedirect } from "./auth/useReturnToRedirect";
import { FeedbackWidget } from "./components/FeedbackWidget";

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

  // After OIDC callback, redirect to the saved URL
  useReturnToRedirect();

  return (
    <FaroRoutes>
      <Route index element={<HomePage />} />
      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route path="groups/new" element={<GroupForm />} />
        <Route path="groups/:groupId" element={<GroupDetail />} />
        <Route path="groups/:groupId/members" element={<GroupMembers />} />
        <Route path="groups/:groupId/stats" element={<GroupRatings />} />
        <Route path="groups/:groupId/settings" element={<GroupSettings />} />
        <Route path="groups/:groupId/edit" element={<GroupEditForm />} />
        <Route
          path="groups/:groupId/attributes"
          element={<AttributesEditor />}
        />
        <Route path="groups/:groupId/ratings" element={<PlayerRatings />} />
        <Route path="groups/:groupId/vote" element={<PlayerVoting />} />
        <Route
          path="groups/:groupId/disponibilidad"
          element={<WeeklyAvailability />}
        />
        <Route path="groups/:groupId/matches/new" element={<MatchForm />} />
        <Route path="groups/:groupId/matches/past" element={<PastMatches />} />
        <Route
          path="groups/:groupId/matches/:matchId"
          element={<MatchDetail />}
        >
          <Route index element={<MatchPlayers />} />
          <Route path="equipos" element={<MatchTeams />} />
        </Route>
        <Route
          path="groups/:groupId/matches/:matchId/edit"
          element={<MatchForm />}
        />
        <Route path="invite/:token" element={<JoinByInvite />} />
      </Route>
    </FaroRoutes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <FaroErrorBoundary>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
        <FeedbackWidget />
      </FaroErrorBoundary>
    </QueryClientProvider>
  );
}
