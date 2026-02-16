import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-sm">
          <img src="/bosarsa.jpeg" alt="BOS-ARSA" className="h-20 mx-auto mb-4 rounded" />
          <h1 className="text-2xl font-bold text-[#1e3a5f] text-center mb-1">BOS-ARSA Log</h1>
          <p className="text-sm text-gray-500 text-center mb-6">Im Sinne der Sicherheit</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Benutzername</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Passwort</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1e3a5f] hover:bg-[#2a4a7f] text-white font-medium py-2 rounded-lg disabled:opacity-50"
            >
              {loading ? 'Anmelden...' : 'Anmelden'}
            </button>
          </form>
        </div>
      </div>
      <footer className="bg-gray-100 border-t text-center py-3 text-xs text-gray-500 flex items-center justify-center gap-2 sm:gap-4 flex-wrap px-2">
        <a href="https://oeradio.at" target="_blank" rel="noopener noreferrer" className="hover:text-gray-700">oeradio.at</a>
        <span>·</span>
        <a href="https://bos-arsa.at" target="_blank" rel="noopener noreferrer" className="hover:text-gray-700">bos-arsa.at</a>
        <span>·</span>
        <a href="https://github.com/achildrenmile/bosarsalog/releases/tag/v1.0.0-beta.1" target="_blank" rel="noopener noreferrer" className="hover:text-gray-700">v1.0.0-beta.1</a>
      </footer>
    </div>
  );
}
