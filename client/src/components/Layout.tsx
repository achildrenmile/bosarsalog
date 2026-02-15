import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Layout() {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen">
      <nav className="bg-[#5b3a1a] text-white px-4 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-6">
          <Link to="/" className="text-lg font-bold tracking-wide hover:text-amber-200">
            BOS-ARSA Log
          </Link>
          <Link to="/" className="text-sm hover:text-amber-200">
            Dashboard
          </Link>
          <Link to="/operators" className="text-sm hover:text-amber-200">
            Rufzeichen
          </Link>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-amber-200 font-mono">{admin?.callsign}</span>
          <button
            onClick={handleLogout}
            className="bg-amber-700 hover:bg-amber-800 px-3 py-1 rounded text-xs"
          >
            Abmelden
          </button>
        </div>
      </nav>
      <main className="p-4 max-w-[1600px] mx-auto">
        <Outlet />
      </main>
    </div>
  );
}
