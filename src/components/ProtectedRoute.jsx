/**
 * ProtectedRoute.jsx
 *
 * A wrapper component that enforces authentication on any route it guards.
 * - While the initial auth check is loading, shows a full-screen spinner.
 * - If the user is not authenticated, redirects them to /login.
 * - If authenticated, renders the protected content.
 */
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { isAuthenticated, authLoading, isAdmin } = useAuth();

  // Wait for Supabase to restore the session before making a redirect decision.
  // Without this, the app would always flash a redirect to /login on page refresh.
  if (authLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          width: '100vw',
          background: '#f8fafc',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          flexDirection: 'column',
          gap: 16,
          color: '#64748b',
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            border: '3px solid #e2e8f0',
            borderTopColor: '#3b82f6',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <span style={{ fontSize: '0.9rem' }}>Verifying session…</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Admin-only guard: redirect non-admin users to the welcome page
  if (adminOnly && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  // Supports both wrapper usage (<ProtectedRoute><Page /></ProtectedRoute>)
  // and layout route usage (children prop from React Router's <Outlet />).
  return children ? children : <Outlet />;
}
