import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../services/api';

export default function ExerciseSetupPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [exercise, setExercise] = useState<any>(null);
  const [allRepeaters, setAllRepeaters] = useState<any[]>([]);
  const [activeRepeaters, setActiveRepeaters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      apiFetch(`/api/v1/exercises/${id}`),
      apiFetch('/api/v1/repeaters'),
    ]).then(([ex, reps]) => {
      setExercise(ex);
      setAllRepeaters(reps);
      setActiveRepeaters(ex.repeaters || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  const toggleRepeater = async (repeaterId: number) => {
    const isActive = activeRepeaters.some(r => r.repeater_id === repeaterId);
    if (isActive) {
      await apiFetch(`/api/v1/exercises/${id}/repeaters/${repeaterId}`, { method: 'DELETE' });
      setActiveRepeaters(prev => prev.filter(r => r.repeater_id !== repeaterId));
    } else {
      await apiFetch(`/api/v1/exercises/${id}/repeaters`, {
        method: 'POST',
        body: JSON.stringify({ repeater_id: repeaterId }),
      });
      const updated = await apiFetch(`/api/v1/exercises/${id}/repeaters`);
      setActiveRepeaters(updated);
    }
  };

  const updateOp = async (repeaterId: number, callsign: string) => {
    await apiFetch(`/api/v1/exercises/${id}/repeaters/${repeaterId}`, {
      method: 'PATCH',
      body: JSON.stringify({ operator_callsign: callsign || null }),
    });
  };

  const activateExercise = async () => {
    await apiFetch(`/api/v1/exercises/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'active' }),
    });
    navigate(`/exercises/${id}`);
  };

  if (loading) return <p className="text-gray-500">Laden...</p>;
  if (!exercise) return <p className="text-red-500">Übung nicht gefunden</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#5b3a1a]">
          Übung einrichten — {new Date(exercise.date + 'T00:00:00').toLocaleDateString('de-AT')}
        </h1>
        <div className="flex gap-2">
          <Link to={`/exercises/${id}`} className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1.5 rounded text-sm">
            Zurück
          </Link>
          <button onClick={activateExercise} className="bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded text-sm font-medium">
            Übung starten
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-4">
        <h2 className="text-lg font-semibold text-[#5b3a1a] mb-3">Umsetzer aktivieren</h2>
        <div className="space-y-2">
          {allRepeaters.map(rep => {
            const active = activeRepeaters.find(r => r.repeater_id === rep.id);
            return (
              <div key={rep.id} className="flex items-center gap-3 py-2 border-b border-gray-100">
                <label className="flex items-center gap-2 cursor-pointer flex-1">
                  <input
                    type="checkbox"
                    checked={!!active}
                    onChange={() => toggleRepeater(rep.id)}
                    className="w-4 h-4 accent-amber-600"
                  />
                  <span className="font-medium text-sm">{rep.short_name}</span>
                  <span className="text-xs text-gray-500">
                    {rep.frequency_mhz && `${rep.frequency_mhz} MHz`}
                    {rep.callsign && ` (${rep.callsign})`}
                  </span>
                  {rep.is_linked ? <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">linked</span> : null}
                </label>
                {active && (
                  <input
                    type="text"
                    placeholder="OP Rufzeichen"
                    defaultValue={active.operator_callsign || ''}
                    onBlur={e => updateOp(rep.id, e.target.value.toUpperCase())}
                    className="border border-gray-300 rounded px-2 py-1 text-sm font-mono uppercase w-28"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
