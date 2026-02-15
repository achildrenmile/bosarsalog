import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiFetch } from '../services/api';

export default function ReportsPage() {
  const { id } = useParams<{ id: string }>();
  const [exercise, setExercise] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [nebenstationen, setNebenstationen] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      apiFetch(`/api/v1/exercises/${id}`),
      apiFetch(`/api/v1/exercises/${id}/stats`),
      apiFetch(`/api/v1/exercises/${id}/nebenstationen`),
    ]).then(([ex, st, nb]) => {
      setExercise(ex);
      setStats(st);
      setNebenstationen(nb);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="text-gray-500">Laden...</p>;
  if (!exercise) return <p className="text-red-500">Nicht gefunden</p>;

  // Group nebenstationen by Bundesland
  const byBl: Record<string, any[]> = {};
  for (const n of nebenstationen) {
    if (!byBl[n.bundesland]) byBl[n.bundesland] = [];
    byBl[n.bundesland].push(n);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#5b3a1a]">
          Auswertung — {new Date(exercise.date + 'T00:00:00').toLocaleDateString('de-AT')}
        </h1>
        <Link to={`/exercises/${id}`} className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1.5 rounded text-sm">
          Zurück
        </Link>
      </div>

      {/* Summary stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-lg shadow-sm p-4 text-center">
            <div className="text-3xl font-bold text-[#5b3a1a]">{stats.totalParticipants}</div>
            <div className="text-sm text-gray-500">Teilnehmer</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 text-center">
            <div className="text-3xl font-bold text-[#5b3a1a]">{stats.totalReports}</div>
            <div className="text-sm text-gray-500">Rapporte</div>
          </div>
          {stats.perRepeater?.map((r: any) => (
            <div key={r.short_name} className="bg-white rounded-lg shadow-sm p-4 text-center">
              <div className="text-2xl font-bold text-gray-700">{r.count}</div>
              <div className="text-xs text-gray-500">{r.short_name}</div>
            </div>
          ))}
        </div>
      )}

      {/* Nebenstationen */}
      <div className="bg-white rounded-xl shadow p-4">
        <h2 className="text-lg font-semibold text-[#5b3a1a] mb-3">Nebenstationen nach Bezirk</h2>
        {Object.entries(byBl).map(([bl, districts]) => (
          <div key={bl} className="mb-3">
            <h3 className="font-medium text-sm text-gray-700 mb-1">{bl}</h3>
            <div className="flex flex-wrap gap-2">
              {districts.map(d => (
                <span
                  key={d.bezirk_code}
                  className={`text-xs px-2 py-1 rounded ${d.is_capital ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-700'}`}
                >
                  {d.bezirk_code}: {d.count}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Export buttons */}
      <div className="bg-white rounded-xl shadow p-4">
        <h2 className="text-lg font-semibold text-[#5b3a1a] mb-3">Export</h2>
        <div className="flex flex-wrap gap-3">
          <a
            href={`/api/v1/export/exercises/${id}/bund`}
            className="bg-amber-100 hover:bg-amber-200 text-amber-800 px-4 py-2 rounded text-sm font-medium"
            target="_blank"
          >
            TXT — Bund (Bundesland)
          </a>
          <a
            href={`/api/v1/export/exercises/${id}/land`}
            className="bg-amber-100 hover:bg-amber-200 text-amber-800 px-4 py-2 rounded text-sm font-medium"
            target="_blank"
          >
            TXT — Land (Umsetzer)
          </a>
          <a
            href={`/api/v1/export/exercises/${id}/combined`}
            className="bg-amber-100 hover:bg-amber-200 text-amber-800 px-4 py-2 rounded text-sm font-medium"
            target="_blank"
          >
            TXT — Kombiniert
          </a>
        </div>
      </div>
    </div>
  );
}
