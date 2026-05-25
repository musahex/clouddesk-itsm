import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import TicketsPage from './pages/TicketsPage';
import TicketDetailPage from './pages/TicketDetailPage';
import CreateTicketPage from './pages/CreateTicketPage';
import KnowledgeBasePage from './pages/KnowledgeBasePage';
import KnowledgeArticlePage from './pages/KnowledgeArticlePage';
import CreateKnowledgeArticlePage from './pages/CreateKnowledgeArticlePage';
import EditKnowledgeArticlePage from './pages/EditKnowledgeArticlePage';
import CreateSupportAgentPage from './pages/CreateSupportAgentPage';
import SystemHealthPage from './pages/SystemHealthPage';

// Redirects already-authenticated users away from public pages
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <RegisterPage />
          </PublicRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tickets"
        element={
          <ProtectedRoute>
            <TicketsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tickets/new"
        element={
          <ProtectedRoute>
            <CreateTicketPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tickets/:id"
        element={
          <ProtectedRoute>
            <TicketDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/kb"
        element={
          <ProtectedRoute>
            <KnowledgeBasePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/kb/new"
        element={
          <ProtectedRoute>
            <CreateKnowledgeArticlePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/kb/:id"
        element={
          <ProtectedRoute>
            <KnowledgeArticlePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/kb/:id/edit"
        element={
          <ProtectedRoute>
            <EditKnowledgeArticlePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/support-agents/new"
        element={
          <AdminRoute>
            <CreateSupportAgentPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/system-health"
        element={
          <AdminRoute>
            <SystemHealthPage />
          </AdminRoute>
        }
      />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
