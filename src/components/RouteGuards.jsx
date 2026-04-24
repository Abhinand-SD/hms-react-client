import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, homeFor } from '../lib/auth';

function FullScreenSpinner() {
  return (
    <div className="flex min-h-full items-center justify-center bg-slate-50">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
    </div>
  );
}

export function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <FullScreenSpinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return children;
}

export function RequireRole({ roles, children }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <FullScreenSpinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (!roles.includes(user.role)) return <Navigate to={homeFor(user)} replace />;
  return children;
}

export function RedirectHome() {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenSpinner />;
  return <Navigate to={homeFor(user)} replace />;
}
