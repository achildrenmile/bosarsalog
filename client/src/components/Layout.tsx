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
    <div className="min-h-screen flex flex-col">
      <nav className="bg-[#5b3a1a] text-white px-4 py-2 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-4">
          <a href="https://oeradio.at" target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
            <img src="/oeradiokl.png" alt="OERadio" className="h-10" />
          </a>
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
          <span className="text-amber-200">{admin?.username}</span>
          <button
            onClick={handleLogout}
            className="bg-amber-700 hover:bg-amber-800 px-3 py-1 rounded text-xs"
          >
            Abmelden
          </button>
        </div>
      </nav>
      <main className="p-4 max-w-[1600px] mx-auto flex-1 w-full">
        <Outlet />
      </main>
      <footer className="bg-gray-100 border-t text-center py-3 text-xs text-gray-500 flex items-center justify-center gap-4">
        <a href="https://oeradio.at" target="_blank" rel="noopener noreferrer" className="hover:text-gray-700">oeradio.at</a>
        <span>·</span>
        <Link to="/impressum" className="hover:text-gray-700">Impressum</Link>
        <span>·</span>
        <Link to="/datenschutz" className="hover:text-gray-700">Datenschutz</Link>
      </footer>
    </div>
  );
}
