import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from '../services/api';

const EXERCISE_TYPES = [
  'Krisenkommunikationsübung',
  'Notfunkübung',
  'Feldtag',
  'Relaisfunktest',
];

interface ExerciseSummary {
  id: string;
  name: string | null;
  date: string;
  participant_count: number;
  report_count: number;
}

export default function DashboardPage() {
  const { admin } = useAuth();
  const navigate = useNavigate();
  const [exercises, setExercises] = useState<ExerciseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newDate, setNewDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [newName, setNewName] = useState(EXERCISE_TYPES[0]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    apiFetch('/api/v1/exercises')
      .then(data => setExercises(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (d: string) => {
    const date = new Date(d + 'T00:00:00');
    return date.toLocaleDateString('de-AT', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#5b3a1a]">Gesamtübersicht</h1>
          <p className="text-sm text-gray-500">Willkommen, {admin?.username}</p>
        </div>
        {admin?.role === 'admin' && (
          <button
            onClick={() => setShowCreate(v => !v)}
            className="bg-[#5b3a1a] hover:bg-[#7a5230] text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            + Neue Übung
          </button>
        )}
      </div>

      {showCreate && (
        <div className="bg-white rounded-xl shadow p-4 mb-6">
          <h2 className="text-sm font-semibold text-[#5b3a1a] mb-3">Neue Übung anlegen</h2>
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Datum</label>
              <input
                type="date"
                value={newDate}
                onChange={e => setNewDate(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs text-gray-500 mb-1">Typ / Name</label>
              <div className="flex gap-2">
                <select
                  value={EXERCISE_TYPES.includes(newName) ? newName : ''}
                  onChange={e => setNewName(e.target.value)}
                  className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {EXERCISE_TYPES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                  <option value="">Eigener Name...</option>
                </select>
                {!EXERCISE_TYPES.includes(newName) && (
                  <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="Name der Übung"
                    className="border border-gray-300 rounded px-2 py-1.5 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    autoFocus
                  />
                )}
              </div>
            </div>
            <button
              disabled={creating || !newDate || !newName}
              onClick={async () => {
                setCreating(true);
                try {
                  const ex = await apiFetch('/api/v1/exercises', {
                    method: 'POST',
                    body: JSON.stringify({ date: newDate, name: newName }),
                  });
                  navigate(`/exercises/${ex.id}/setup`);
                } catch {
                } finally {
                  setCreating(false);
                }
              }}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded text-sm font-medium disabled:opacity-50"
            >
              {creating ? 'Erstellen...' : 'Erstellen'}
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="text-gray-500 text-sm hover:text-gray-700"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Laden...</p>
      ) : exercises.length === 0 ? (
        <p className="text-gray-500">Noch keine Übungen erstellt.</p>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#5b3a1a] text-white">
              <tr>
                <th className="px-4 py-2 text-left">Datum</th>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-right">Teilnehmer</th>
                <th className="px-4 py-2 text-right">Rapporte</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {exercises.map(ex => {
                const today = new Date().toISOString().split('T')[0];
                const isNearest = ex.id === exercises.reduce((closest, e) => {
                  const dCur = Math.abs(new Date(e.date).getTime() - new Date(today).getTime());
                  const dBest = Math.abs(new Date(closest.date).getTime() - new Date(today).getTime());
                  return dCur < dBest ? e : closest;
                }, exercises[0]).id;

                return (
                  <tr key={ex.id} className={`border-t ${isNearest ? 'bg-amber-100 font-medium' : 'hover:bg-amber-50'}`}>
                    <td className="px-4 py-2 font-mono">
                      {formatDate(ex.date)}
                      {isNearest && <span className="ml-2 text-xs bg-amber-600 text-white px-1.5 py-0.5 rounded">Aktuell</span>}
                    </td>
                    <td className="px-4 py-2 text-gray-700">{ex.name || '—'}</td>
                    <td className="px-4 py-2 text-right">{ex.participant_count}</td>
                    <td className="px-4 py-2 text-right">{ex.report_count}</td>
                    <td className="px-4 py-2 text-right">
                      <Link to={`/exercises/${ex.id}`} className="text-amber-700 hover:underline text-xs">
                        Öffnen
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
