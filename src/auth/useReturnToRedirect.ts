import { useEffect } from "react";
import { useAuth } from "react-oidc-context";
import { useNavigate, useLocation } from "react-router-dom";

/**
 * After OIDC login completes (callback lands on /), navigate to the
 * URL that was saved in sessionStorage before the redirect.
 */
export function useReturnToRedirect() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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
}
