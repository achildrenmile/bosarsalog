import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from '../services/api';

interface ExerciseSummary {
  id: number;
  name: string | null;
  date: string;
  status: string;
  participant_count: number;
  report_count: number;
}

export default function DashboardPage() {
  const { admin } = useAuth();
  const [exercises, setExercises] = useState<ExerciseSummary[]>([]);
  const [loading, setLoading] = useState(true);

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

  const statusColor = (s: string) => {
    if (s === 'active') return 'bg-green-500';
    if (s === 'completed') return 'bg-blue-500';
    return 'bg-gray-400';
  };

  const statusLabel = (s: string) => {
    if (s === 'active') return 'Aktiv';
    if (s === 'completed') return 'Abgeschlossen';
    return 'Geplant';
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#5b3a1a]">Gesamtübersicht</h1>
          <p className="text-sm text-gray-500">Willkommen, {admin?.callsign}</p>
        </div>
        <Link
          to="#"
          onClick={async (e) => {
            e.preventDefault();
            const today = new Date();
            const day = today.getDay();
            const nextSunday = new Date(today);
            nextSunday.setDate(today.getDate() + (7 - day) % 7);
            const dateStr = nextSunday.toISOString().split('T')[0];
            try {
              const ex = await apiFetch('/api/v1/exercises', {
                method: 'POST',
                body: JSON.stringify({ date: dateStr }),
              });
              window.location.href = `/exercises/${ex.id}/setup`;
            } catch {}
          }}
          className="bg-[#5b3a1a] hover:bg-[#7a5230] text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          + Neue Übung
        </Link>
      </div>

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
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-right">Teilnehmer</th>
                <th className="px-4 py-2 text-right">Rapporte</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {exercises.map(ex => (
                <tr key={ex.id} className="border-t hover:bg-amber-50">
                  <td className="px-4 py-2 font-mono">{formatDate(ex.date)}</td>
                  <td className="px-4 py-2 text-gray-700">{ex.name || '—'}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs text-white ${statusColor(ex.status)}`}>
                      {statusLabel(ex.status)}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">{ex.participant_count}</td>
                  <td className="px-4 py-2 text-right">{ex.report_count}</td>
                  <td className="px-4 py-2 text-right">
                    <Link to={`/exercises/${ex.id}`} className="text-amber-700 hover:underline text-xs">
                      Öffnen
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
