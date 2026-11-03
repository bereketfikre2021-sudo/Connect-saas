import { useEffect, useRef } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AdminRoute() {
  const { user, loading, isAdmin, ssoEnabled, signInWithSSO } = useAuth();
  const location = useLocation();
  // Guard against triggering SSO more than once per mount.
  const ssoInitiated = useRef(false);

  useEffect(() => {
    // Once loading is done, if there's no user and SSO is configured,
    // auto-initiate the OAuth flow instead of showing the login page.
    // The ref prevents a double-fire if loading flips twice.
    if (!loading && !user && ssoEnabled && !ssoInitiated.current) {
      ssoInitiated.current = true;
      const returnTo = location.pathname + location.search;
      void signInWithSSO(returnTo === '/login' ? '/' : returnTo);
    }
  }, [loading, user, ssoEnabled, signInWithSSO, location]);

  // Always block while auth + admin check are in flight.
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-navy">
        <div className="w-8 h-8 border-4 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // No session — if SSO is configured we've already kicked off the redirect
  // above; show the spinner while the browser navigates away.
  // If SSO is not configured, fall back to the login page.
  if (!user) {
    if (ssoEnabled) {
      // Browser is about to redirect to the IdP — keep showing the spinner.
      return (
        <div className="flex items-center justify-center min-h-screen bg-navy">
          <div className="w-8 h-8 border-4 border-gold border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }
    return <Navigate to="/login" replace />;
  }

  // Authenticated but not an admin — show the unauthorized page, not login.
  // This prevents confusing the user with a login form they can't use.
  if (!isAdmin) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}
