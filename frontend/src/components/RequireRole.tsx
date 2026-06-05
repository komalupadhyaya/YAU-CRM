import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { UserRole } from '@/utils/permissions';

interface RequireRoleProps {
  roles: UserRole[];
  children: React.ReactNode;
  /** Where to redirect if the user doesn't have the required role. Defaults to /dashboard */
  redirectTo?: string;
}

/**
 * Route guard component that checks if the current user has one of the required roles.
 * If not, redirects to /dashboard (or a custom redirectTo path).
 *
 * Usage:
 *   <RequireRole roles={['admin']}>
 *     <Settings />
 *   </RequireRole>
 */
export default function RequireRole({ roles, children, redirectTo = '/dashboard' }: RequireRoleProps) {
  const { currentUser, loading } = useAuth();

  // Don't flash a redirect while the user data is loading
  if (loading) return null;

  if (!currentUser || !roles.includes(currentUser.role as UserRole)) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
