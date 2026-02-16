import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ExercisePage from './pages/ExercisePage';
import ExerciseSetupPage from './pages/ExerciseSetupPage';
import OperatorsPage from './pages/OperatorsPage';
import ReportsPage from './pages/ReportsPage';
import ImpressumPage from './pages/ImpressumPage';
import DatenschutzPage from './pages/DatenschutzPage';
import HilfePage from './pages/HilfePage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="exercises/:id" element={<ExercisePage />} />
          <Route path="exercises/:id/setup" element={<ExerciseSetupPage />} />
          <Route path="exercises/:id/reports" element={<ReportsPage />} />
          <Route path="operators" element={<OperatorsPage />} />
          <Route path="impressum" element={<ImpressumPage />} />
          <Route path="datenschutz" element={<DatenschutzPage />} />
          <Route path="hilfe" element={<HilfePage />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
