import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  // Hold render until localStorage rehydration completes to prevent login flash
  if (isLoading) return null;
  if (!user) return <Navigate to="/login" replace />;

  return <>{children}</>;
}
