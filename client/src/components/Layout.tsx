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
      <nav className="bg-[#1e3a5f] text-white px-2 sm:px-4 py-2 flex items-center justify-between shadow-md gap-2">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <a href="https://bosarsa.oeradio.at" target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
            <img src="/bosarsa.jpeg" alt="BOS-ARSA" className="h-8 sm:h-10 rounded" />
          </a>
          <Link to="/" className="hover:text-blue-200 flex-shrink-0">
            <div className="text-base sm:text-lg font-bold tracking-wide leading-tight">BOS-ARSA Log</div>
            <div className="text-[10px] text-blue-300 tracking-wider hidden sm:block">Im Sinne der Sicherheit</div>
          </Link>
          <Link to="/" className="text-xs sm:text-sm hover:text-blue-200 hidden sm:inline">
            Dashboard
          </Link>
          <Link to="/operators" className="text-xs sm:text-sm hover:text-blue-200 hidden sm:inline">
            Rufzeichen
          </Link>
          <Link to="/reports" className="text-xs sm:text-sm hover:text-blue-200 hidden sm:inline">
            Auswertung
          </Link>
          <Link to="/hilfe" className="text-xs sm:text-sm hover:text-blue-200 hidden sm:inline">
            Hilfe
          </Link>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 text-sm flex-shrink-0">
          <span className="text-blue-200 text-xs sm:text-sm">{admin?.username}</span>
          <button
            onClick={handleLogout}
            className="bg-red-700 hover:bg-red-800 px-2 sm:px-3 py-1 rounded text-xs"
          >
            Abmelden
          </button>
        </div>
      </nav>
      <div className="sm:hidden bg-[#1e3a5f] text-white px-2 pb-2 flex gap-3 text-xs border-t border-white/10">
        <Link to="/" className="hover:text-blue-200">Dashboard</Link>
        <Link to="/operators" className="hover:text-blue-200">Rufzeichen</Link>
        <Link to="/reports" className="hover:text-blue-200">Auswertung</Link>
        <Link to="/hilfe" className="hover:text-blue-200">Hilfe</Link>
      </div>
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
        <span>·</span>
        <a href="https://github.com/achildrenmile/bosarsalog" target="_blank" rel="noopener noreferrer" className="hover:text-gray-700">GitHub</a>
        <span>·</span>
        <a href="https://github.com/achildrenmile/bosarsalog/releases/tag/v1.0.8" target="_blank" rel="noopener noreferrer" className="hover:text-gray-700">v1.0.8</a>
      </footer>
    </div>
  );
}
