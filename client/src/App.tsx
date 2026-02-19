import { Routes, Route, Navigate, Link, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ExercisePage from './pages/ExercisePage';
import ExerciseSetupPage from './pages/ExerciseSetupPage';
import OperatorsPage from './pages/OperatorsPage';
import ReportsPage from './pages/ReportsPage';
import AggregatedReportsPage from './pages/AggregatedReportsPage';
import ImpressumPage from './pages/ImpressumPage';
import DatenschutzPage from './pages/DatenschutzPage';
import HilfePage from './pages/HilfePage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <nav className="bg-[#1e3a5f] text-white px-2 sm:px-4 py-2 flex items-center gap-2 sm:gap-4 shadow-md">
        <Link to="/login" className="hover:text-blue-200 flex-shrink-0">
          <div className="text-base sm:text-lg font-bold tracking-wide leading-tight">BOS-ARSA Log</div>
        </Link>
      </nav>
      <main className="p-2 sm:p-4 max-w-[1600px] mx-auto flex-1 w-full">
        <Outlet />
      </main>
      <footer className="bg-gray-100 border-t text-center py-3 text-xs text-gray-500 flex items-center justify-center gap-2 sm:gap-4 flex-wrap px-2">
        <a href="https://oeradio.at" target="_blank" rel="noopener noreferrer" className="hover:text-gray-700">oeradio.at</a>
        <span>·</span>
        <a href="https://bosarsa.oeradio.at" target="_blank" rel="noopener noreferrer" className="hover:text-gray-700">bosarsa.oeradio.at</a>
        <span>·</span>
        <Link to="/impressum" className="hover:text-gray-700">Impressum</Link>
        <span>·</span>
        <Link to="/datenschutz" className="hover:text-gray-700">Datenschutz</Link>
        <span>·</span>
        <Link to="/hilfe" className="hover:text-gray-700">Hilfe</Link>
      </footer>
    </div>
  );
}

function FlexLayout() {
  const { token } = useAuth();
  return token ? <Layout /> : <PublicLayout />;
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
          <Route path="reports" element={<AggregatedReportsPage />} />
          <Route path="operators" element={<OperatorsPage />} />
        </Route>
        <Route element={<FlexLayout />}>
          <Route path="/impressum" element={<ImpressumPage />} />
          <Route path="/datenschutz" element={<DatenschutzPage />} />
          <Route path="/hilfe" element={<HilfePage />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
