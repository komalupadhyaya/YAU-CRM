import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * RequireAuth — Centralized session guard using AuthContext.
 *
 * It reads the globally cached currentUser session state.
 * Shows nothing while loading to prevent login screen flicker.
 */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { currentUser, loading } = useAuth();

  if (loading) return null;  // Blank while verifying — no flicker
  if (!currentUser) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
