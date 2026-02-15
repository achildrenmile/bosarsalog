import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../services/api';
import { useAuth } from '../hooks/useAuth';

const BUNDESLAENDER = [
  { code: '01', name: 'Wien', label: 'OE1' },
  { code: '02', name: 'Salzburg', label: 'OE2' },
  { code: '03', name: 'Niederösterreich', label: 'OE3' },
  { code: '04', name: 'Burgenland', label: 'OE4' },
  { code: '05', name: 'Oberösterreich', label: 'OE5' },
  { code: '06', name: 'Steiermark', label: 'OE6' },
  { code: '07', name: 'Tirol', label: 'OE7' },
  { code: '08', name: 'Kärnten', label: 'OE8' },
  { code: '09', name: 'Vorarlberg', label: 'OE9' },
];

export default function ExerciseSetupPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { admin } = useAuth();
  const isAdmin = admin?.role === 'admin';
  const [exercise, setExercise] = useState<any>(null);
  const [allRepeaters, setAllRepeaters] = useState<any[]>([]);
  const [activeRepeaters, setActiveRepeaters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeBundeslaender, setActiveBundeslaender] = useState<Set<string>>(new Set());
  const [expandedBl, setExpandedBl] = useState<Set<string>>(new Set());
  const [showAddForm, setShowAddForm] = useState<string | null>(null); // bundesland_code or 'simplex'
  const [newRepName, setNewRepName] = useState('');
  const [newRepFreq, setNewRepFreq] = useState('');
  const [newRepOffset, setNewRepOffset] = useState('');
  const [newRepCtcss, setNewRepCtcss] = useState('');
  const [newRepCallsign, setNewRepCallsign] = useState('');

  useEffect(() => {
    if (!id) return;
    Promise.all([
      apiFetch(`/api/v1/exercises/${id}`),
      apiFetch('/api/v1/repeaters'),
    ]).then(([ex, reps]) => {
      setExercise(ex);
      setAllRepeaters(reps);
      setActiveRepeaters(ex.repeaters || []);
      // Determine which Bundesländer have active repeaters
      const activeBl = new Set<string>();
      for (const er of (ex.repeaters || [])) {
        const rep = reps.find((r: any) => r.id === er.repeater_id);
        if (rep?.bundesland_code) activeBl.add(rep.bundesland_code);
      }
      setActiveBundeslaender(activeBl);
      setExpandedBl(new Set(activeBl));
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  const repeatersForBl = (blCode: string) =>
    allRepeaters.filter(r => r.bundesland_code === blCode && r.type !== 'simplex');

  const simplexRepeaters = allRepeaters.filter(r => r.type === 'simplex');

  const toggleBundesland = async (blCode: string) => {
    const isActive = activeBundeslaender.has(blCode);
    const newSet = new Set(activeBundeslaender);
    const newExpanded = new Set(expandedBl);

    if (isActive) {
      // Deactivate all repeaters for this Bundesland
      const blReps = repeatersForBl(blCode);
      for (const rep of blReps) {
        if (activeRepeaters.some(r => r.repeater_id === rep.id)) {
          await apiFetch(`/api/v1/exercises/${id}/repeaters/${rep.id}`, { method: 'DELETE' });
        }
      }
      newSet.delete(blCode);
      newExpanded.delete(blCode);
      setActiveRepeaters(prev => prev.filter(r => {
        const rep = allRepeaters.find(ar => ar.id === r.repeater_id);
        return rep?.bundesland_code !== blCode;
      }));
    } else {
      newSet.add(blCode);
      newExpanded.add(blCode);
    }

    setActiveBundeslaender(newSet);
    setExpandedBl(newExpanded);
  };

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

  const activateExercise = async () => {
    await apiFetch(`/api/v1/exercises/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'active' }),
    });
    navigate(`/exercises/${id}`);
  };

  const addCustomRepeater = async (bundeslandCode: string | null) => {
    if (!newRepName && !newRepFreq) return;
    const type = bundeslandCode === null ? 'simplex' : 'repeater';
    const name = newRepName || `Direkte ${newRepFreq}`;
    const rep = await apiFetch('/api/v1/repeaters', {
      method: 'POST',
      body: JSON.stringify({
        short_name: name,
        frequency_mhz: newRepFreq ? parseFloat(newRepFreq) : null,
        offset_mhz: newRepOffset ? parseFloat(newRepOffset) : null,
        ctcss_hz: newRepCtcss ? parseFloat(newRepCtcss) : null,
        callsign: newRepCallsign || null,
        band: newRepFreq ? (parseFloat(newRepFreq) > 400 ? '70cm' : parseFloat(newRepFreq) > 200 ? '23cm' : '2m') : null,
        type,
        bundesland_code: bundeslandCode,
      }),
    });
    setAllRepeaters(prev => [...prev, rep]);
    // Auto-activate it
    await apiFetch(`/api/v1/exercises/${id}/repeaters`, {
      method: 'POST',
      body: JSON.stringify({ repeater_id: rep.id }),
    });
    const updated = await apiFetch(`/api/v1/exercises/${id}/repeaters`);
    setActiveRepeaters(updated);
    setNewRepName('');
    setNewRepFreq('');
    setNewRepOffset('');
    setNewRepCtcss('');
    setNewRepCallsign('');
    setShowAddForm(null);
  };

  const toggleExpanded = (blCode: string) => {
    setExpandedBl(prev => {
      const next = new Set(prev);
      if (next.has(blCode)) next.delete(blCode);
      else next.add(blCode);
      return next;
    });
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
          {isAdmin && (
            <button onClick={activateExercise} className="bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded text-sm font-medium">
              Übung starten
            </button>
          )}
        </div>
      </div>

      {/* Exercise name (admin only) */}
      {isAdmin && (
        <div className="bg-white rounded-xl shadow p-4">
          <h2 className="text-lg font-semibold text-[#5b3a1a] mb-3">Name der Übung</h2>
          <input
            type="text"
            defaultValue={exercise.name || ''}
            placeholder="z.B. Sonntagsrunde KW 07"
            onBlur={async (e) => {
              await apiFetch(`/api/v1/exercises/${id}`, {
                method: 'PATCH',
                body: JSON.stringify({ name: e.target.value || null }),
              });
            }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full max-w-md focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
      )}

      {/* Bundesländer selection */}
      <div className="bg-white rounded-xl shadow p-4">
        <h2 className="text-lg font-semibold text-[#5b3a1a] mb-3">Bundesländer auswählen</h2>
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2">
          {BUNDESLAENDER.map(bl => {
            const isActive = activeBundeslaender.has(bl.code);
            const repCount = repeatersForBl(bl.code).length;
            const activeCount = activeRepeaters.filter(ar => {
              const rep = allRepeaters.find(r => r.id === ar.repeater_id);
              return rep?.bundesland_code === bl.code;
            }).length;
            return (
              <button
                key={bl.code}
                onClick={() => isAdmin && toggleBundesland(bl.code)}
                disabled={!isAdmin}
                className={`flex flex-col items-center py-2 px-1 rounded-lg border-2 transition-colors text-sm ${
                  isActive
                    ? 'border-amber-500 bg-amber-50 text-[#5b3a1a]'
                    : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300'
                } ${!isAdmin ? 'cursor-default' : ''}`}
              >
                <span className="font-bold">{bl.label}</span>
                <span className="text-xs truncate w-full text-center">{bl.name}</span>
                {isActive && <span className="text-xs mt-0.5">{activeCount}/{repCount}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Per-Bundesland repeater sections */}
      {BUNDESLAENDER.filter(bl => activeBundeslaender.has(bl.code)).map(bl => {
        const blRepeaters = repeatersForBl(bl.code);
        const isExpanded = expandedBl.has(bl.code);

        return (
          <div key={bl.code} className="bg-white rounded-xl shadow overflow-hidden">
            <button
              onClick={() => toggleExpanded(bl.code)}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="font-bold text-[#5b3a1a]">{bl.label}</span>
                <span className="font-semibold text-[#5b3a1a]">{bl.name}</span>
                <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                  {activeRepeaters.filter(ar => {
                    const rep = allRepeaters.find(r => r.id === ar.repeater_id);
                    return rep?.bundesland_code === bl.code;
                  }).length} / {blRepeaters.length}
                </span>
              </div>
              <span className="text-gray-400">{isExpanded ? '▲' : '▼'}</span>
            </button>

            {isExpanded && (
              <div className="border-t px-4 pb-4">
                <div className="space-y-1 mt-2">
                  {blRepeaters.map(rep => {
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
                          {rep.ctcss_hz && <span className="text-xs text-gray-400">CTCSS {rep.ctcss_hz}</span>}
                          {rep.is_linked ? <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">oelink</span> : null}
                          {rep.is_custom ? <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">custom</span> : null}
                        </label>
                      </div>
                    );
                  })}
                </div>

                {/* Add custom repeater button */}
                {showAddForm === bl.code ? (
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg space-y-2">
                    <div className="flex gap-2 flex-wrap">
                      <input type="text" placeholder="Name" value={newRepName} onChange={e => setNewRepName(e.target.value)} className="border rounded px-2 py-1 text-sm flex-1 min-w-[120px]" />
                      <input type="text" placeholder="Frequenz MHz" value={newRepFreq} onChange={e => setNewRepFreq(e.target.value)} className="border rounded px-2 py-1 text-sm w-28" />
                      <input type="text" placeholder="Offset MHz" value={newRepOffset} onChange={e => setNewRepOffset(e.target.value)} className="border rounded px-2 py-1 text-sm w-24" />
                      <input type="text" placeholder="CTCSS Hz" value={newRepCtcss} onChange={e => setNewRepCtcss(e.target.value)} className="border rounded px-2 py-1 text-sm w-24" />
                      <input type="text" placeholder="Rufzeichen" value={newRepCallsign} onChange={e => setNewRepCallsign(e.target.value.toUpperCase())} className="border rounded px-2 py-1 text-sm font-mono uppercase w-24" />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => addCustomRepeater(bl.code)} className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1 rounded text-sm">Hinzufügen</button>
                      <button onClick={() => setShowAddForm(null)} className="text-gray-500 text-sm hover:text-gray-700">Abbrechen</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowAddForm(bl.code)} className="mt-2 text-sm text-amber-700 hover:text-amber-900 font-medium">
                    + Umsetzer hinzufügen
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Simplex frequencies */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="p-4">
          <h2 className="text-lg font-semibold text-[#5b3a1a] mb-3">Simplex-Frequenzen</h2>
          <div className="space-y-1">
            {simplexRepeaters.map(rep => {
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
                    </span>
                    {rep.is_custom ? <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">custom</span> : null}
                  </label>
                </div>
              );
            })}
          </div>

          {/* Add custom simplex */}
          {showAddForm === 'simplex' ? (
            <div className="mt-3 p-3 bg-gray-50 rounded-lg space-y-2">
              <div className="flex gap-2 flex-wrap">
                <input type="text" placeholder="Name (optional)" value={newRepName} onChange={e => setNewRepName(e.target.value)} className="border rounded px-2 py-1 text-sm flex-1 min-w-[120px]" />
                <input type="text" placeholder="Frequenz MHz" value={newRepFreq} onChange={e => setNewRepFreq(e.target.value)} className="border rounded px-2 py-1 text-sm w-28" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => addCustomRepeater(null)} className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1 rounded text-sm">Hinzufügen</button>
                <button onClick={() => setShowAddForm(null)} className="text-gray-500 text-sm hover:text-gray-700">Abbrechen</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowAddForm('simplex')} className="mt-2 text-sm text-amber-700 hover:text-amber-900 font-medium">
              + Simplex-Frequenz hinzufügen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
