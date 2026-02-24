import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { EXERCISE_TYPES } from '../constants/exerciseTypes';

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
  const [exerciseName, setExerciseName] = useState('');
  const [nameSaveTimer, setNameSaveTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const withSave = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    setSaveStatus('saving');
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    try {
      const result = await fn();
      setSaveStatus('saved');
      savedTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
      return result;
    } catch {
      setSaveStatus('error');
      savedTimerRef.current = setTimeout(() => setSaveStatus('idle'), 3000);
      return undefined;
    }
  }, []);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      apiFetch(`/api/v1/exercises/${id}`),
      apiFetch('/api/v1/repeaters'),
    ]).then(([ex, reps]) => {
      setExercise(ex);
      setExerciseName(ex.name || '');
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
    allRepeaters.filter(r => r.bundesland_code === blCode && r.type !== 'simplex' && !r.is_linked);

  const simplexRepeaters = allRepeaters.filter(r => r.type === 'simplex');

  const toggleBundesland = async (blCode: string) => {
    await withSave(async () => {
      const isActive = activeBundeslaender.has(blCode);
      const newSet = new Set(activeBundeslaender);
      const newExpanded = new Set(expandedBl);

      if (isActive) {
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
    });
  };

  const toggleRepeater = async (repeaterId: number) => {
    const isActive = activeRepeaters.some(r => r.repeater_id === repeaterId);
    if (isActive) {
      if (!isAdmin) return;
      await withSave(async () => {
        await apiFetch(`/api/v1/exercises/${id}/repeaters/${repeaterId}`, { method: 'DELETE' });
        setActiveRepeaters(prev => prev.filter(r => r.repeater_id !== repeaterId));
      });
    } else {
      await withSave(async () => {
        await apiFetch(`/api/v1/exercises/${id}/repeaters`, {
          method: 'POST',
          body: JSON.stringify({ repeater_id: repeaterId }),
        });
        const updated = await apiFetch(`/api/v1/exercises/${id}/repeaters`);
        setActiveRepeaters(updated);
      });
    }
  };

  const addCustomRepeater = async (bundeslandCode: string | null) => {
    if (!newRepName && !newRepFreq) return;
    await withSave(async () => {
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
    });
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
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-base sm:text-xl font-bold text-[#1e3a5f] min-w-0">
          <span className="block sm:inline">Übung einrichten</span>
          <span className="hidden sm:inline"> — </span>
          <span className="block sm:inline text-sm sm:text-xl">{new Date(exercise.date + 'T00:00:00').toLocaleDateString('de-AT')}</span>
        </h1>
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {saveStatus === 'saving' && (
            <span className="text-xs text-amber-600 animate-pulse">Speichern...</span>
          )}
          {saveStatus === 'saved' && (
            <span className="text-xs text-green-600">Gespeichert</span>
          )}
          {saveStatus === 'error' && (
            <span className="text-xs text-red-600">Fehler!</span>
          )}
          {isAdmin && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="bg-red-100 hover:bg-red-200 text-red-700 px-2 sm:px-3 py-1.5 rounded text-xs sm:text-sm"
            >
              Löschen
            </button>
          )}
          <Link to={`/exercises/${id}`} className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-2 sm:px-3 py-1.5 rounded text-xs sm:text-sm">
            Zurück
          </Link>
        </div>
      </div>

      {/* Exercise type + name (admin only) */}
      {isAdmin && (
        <div className="bg-white rounded-xl shadow p-3 sm:p-4">
          <h2 className="text-base sm:text-lg font-semibold text-[#1e3a5f] mb-2 sm:mb-3">Typ & Name der Übung</h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Übungstyp</label>
              <div className="flex gap-2">
                <select
                  value={EXERCISE_TYPES.some(t => t.value === (exercise.exercise_type || '')) ? exercise.exercise_type : '__custom__'}
                  onChange={async (e) => {
                    if (e.target.value === '__custom__') {
                      setExercise((prev: any) => prev ? { ...prev, exercise_type: '' } : null);
                    } else {
                      const val = e.target.value;
                      await withSave(() => apiFetch(`/api/v1/exercises/${id}`, {
                        method: 'PATCH',
                        body: JSON.stringify({ exercise_type: val }),
                      }));
                      setExercise((prev: any) => prev ? { ...prev, exercise_type: val } : null);
                    }
                  }}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {EXERCISE_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                  <option value="__custom__">Eigener Typ...</option>
                </select>
                {!EXERCISE_TYPES.some(t => t.value === (exercise.exercise_type || '')) && (
                  <input
                    type="text"
                    value={exercise.exercise_type || ''}
                    onChange={e => setExercise((prev: any) => prev ? { ...prev, exercise_type: e.target.value } : null)}
                    onBlur={async (e) => {
                      if (e.target.value) {
                        await withSave(() => apiFetch(`/api/v1/exercises/${id}`, {
                          method: 'PATCH',
                          body: JSON.stringify({ exercise_type: e.target.value }),
                        }));
                      }
                    }}
                    placeholder="Typ eingeben"
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-[140px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                )}
              </div>
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Name (optional)</label>
              <input
                type="text"
                value={exerciseName}
                placeholder="z.B. Sonntagsrunde KW 07"
                onChange={(e) => {
                  const val = e.target.value;
                  setExerciseName(val);
                  if (nameSaveTimer) clearTimeout(nameSaveTimer);
                  setNameSaveTimer(setTimeout(async () => {
                    await withSave(() => apiFetch(`/api/v1/exercises/${id}`, {
                      method: 'PATCH',
                      body: JSON.stringify({ name: val || null }),
                    }));
                  }, 800));
                }}
                onBlur={async () => {
                  if (nameSaveTimer) clearTimeout(nameSaveTimer);
                  setNameSaveTimer(null);
                  await withSave(() => apiFetch(`/api/v1/exercises/${id}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ name: exerciseName || null }),
                  }));
                }}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full max-w-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* OE-Link toggle (admin only) */}
      {isAdmin && (
        <div className="bg-white rounded-xl shadow p-3 sm:p-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={exercise.oe_link_enabled !== 0}
              onChange={async (e) => {
                const val = e.target.checked;
                await withSave(async () => {
                  await apiFetch(`/api/v1/exercises/${id}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ oe_link_enabled: val }),
                  });
                  setExercise((prev: any) => prev ? { ...prev, oe_link_enabled: val ? 1 : 0 } : null);
                  if (val) {
                    const linkedReps = allRepeaters.filter(r => r.is_linked);
                    for (const rep of linkedReps) {
                      if (!activeRepeaters.some(r => r.repeater_id === rep.id)) {
                        await apiFetch(`/api/v1/exercises/${id}/repeaters`, {
                          method: 'POST',
                          body: JSON.stringify({ repeater_id: rep.id }),
                        });
                      }
                    }
                    const updated = await apiFetch(`/api/v1/exercises/${id}/repeaters`);
                    setActiveRepeaters(updated);
                  }
                });
              }}
              className="w-5 h-5 accent-red-600"
            />
            <div>
              <span className="font-semibold text-[#1e3a5f] text-sm sm:text-base">OE-Link aktivieren</span>
              <p className="text-xs text-gray-500">OE-Link-Tab und Auswertung anzeigen (deaktivieren für Übungen ohne OE-Link, z.B. 80m Notfunk Runde)</p>
            </div>
          </label>
        </div>
      )}

      {/* Simplex Bezirke toggle (admin only) */}
      {isAdmin && (
        <div className="bg-white rounded-xl shadow p-3 sm:p-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={exercise.simplex_bezirke !== 0}
              onChange={async (e) => {
                const val = e.target.checked;
                await withSave(async () => {
                  const allCodes = val ? BUNDESLAENDER.map(b => b.code).join(',') : null;
                  await apiFetch(`/api/v1/exercises/${id}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ simplex_bezirke: val, simplex_bl_codes: allCodes }),
                  });
                  setExercise((prev: any) => prev ? { ...prev, simplex_bezirke: val ? 1 : 0, simplex_bl_codes: allCodes } : null);
                });
              }}
              className="w-5 h-5 accent-red-600"
            />
            <div>
              <span className="font-semibold text-[#1e3a5f] text-sm sm:text-base">Simplex Bezirke aktivieren</span>
              <p className="text-xs text-gray-500">Simplex-Frequenzen nach Bundesland und Bezirk gruppieren</p>
            </div>
          </label>

          {exercise.simplex_bezirke !== 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-2">Bundesländer für Simplex-Gruppierung:</p>
              <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-1.5">
                {BUNDESLAENDER.map(bl => {
                  const currentCodes = exercise.simplex_bl_codes ? exercise.simplex_bl_codes.split(',') : BUNDESLAENDER.map(b => b.code);
                  const isActive = currentCodes.includes(bl.code);
                  return (
                    <button
                      key={bl.code}
                      onClick={async () => {
                        const codes = exercise.simplex_bl_codes ? exercise.simplex_bl_codes.split(',') : BUNDESLAENDER.map(b => b.code);
                        const newCodes = isActive ? codes.filter((c: string) => c !== bl.code) : [...codes, bl.code];
                        const val = newCodes.length > 0 ? newCodes.sort().join(',') : null;
                        await withSave(async () => {
                          await apiFetch(`/api/v1/exercises/${id}`, {
                            method: 'PATCH',
                            body: JSON.stringify({ simplex_bl_codes: val }),
                          });
                          setExercise((prev: any) => prev ? { ...prev, simplex_bl_codes: val } : null);
                        });
                      }}
                      className={`flex flex-col items-center py-1.5 px-1 rounded border transition-colors text-xs ${
                        isActive
                          ? 'border-red-500 bg-red-50 text-[#1e3a5f] font-semibold'
                          : 'border-gray-200 bg-gray-50 text-gray-400 hover:border-gray-300'
                      }`}
                    >
                      <span>{bl.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bundesländer selection */}
      <div className="bg-white rounded-xl shadow p-3 sm:p-4">
        <h2 className="text-base sm:text-lg font-semibold text-[#1e3a5f] mb-2 sm:mb-3">Bundesländer auswählen</h2>
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2">
          {BUNDESLAENDER.map(bl => {
            const isActive = activeBundeslaender.has(bl.code);
            const repCount = repeatersForBl(bl.code).length;
            const activeCount = activeRepeaters.filter(ar => {
              const rep = allRepeaters.find(r => r.id === ar.repeater_id);
              return rep?.bundesland_code === bl.code && !rep?.is_linked;
            }).length;
            return (
              <button
                key={bl.code}
                onClick={() => isAdmin && toggleBundesland(bl.code)}
                disabled={!isAdmin}
                className={`flex flex-col items-center py-2 px-1 rounded-lg border-2 transition-colors text-sm ${
                  isActive
                    ? 'border-red-500 bg-red-50 text-[#1e3a5f]'
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
                <span className="font-bold text-[#1e3a5f]">{bl.label}</span>
                <span className="font-semibold text-[#1e3a5f]">{bl.name}</span>
                <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full">
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
                        <label className={`flex items-center gap-1.5 sm:gap-2 flex-1 flex-wrap ${!active || isAdmin ? 'cursor-pointer' : 'cursor-default'}`}>
                          <input
                            type="checkbox"
                            checked={!!active}
                            disabled={!!active && !isAdmin}
                            onChange={() => toggleRepeater(rep.id)}
                            className="w-4 h-4 accent-red-600 flex-shrink-0"
                          />
                          <span className="font-medium text-xs sm:text-sm">{rep.short_name}{rep.callsign ? ` (${rep.callsign})` : ''}</span>
                          <span className="text-xs text-gray-500 hidden sm:inline">
                            {rep.frequency_mhz && `${rep.frequency_mhz} MHz`}
                          </span>
                          {rep.ctcss_hz && <span className="text-xs text-gray-400 hidden md:inline">CTCSS {rep.ctcss_hz}</span>}
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
                      <button onClick={() => addCustomRepeater(bl.code)} className="bg-[#c8102e] hover:bg-[#a00d24] text-white px-3 py-1 rounded text-sm">Hinzufügen</button>
                      <button onClick={() => setShowAddForm(null)} className="text-gray-500 text-sm hover:text-gray-700">Abbrechen</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowAddForm(bl.code)} className="mt-2 text-sm text-red-700 hover:text-red-900 font-medium">
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
          <h2 className="text-lg font-semibold text-[#1e3a5f] mb-3">Simplex-Frequenzen</h2>
          <div className="space-y-1">
            {simplexRepeaters.map(rep => {
              const active = activeRepeaters.find(r => r.repeater_id === rep.id);
              return (
                <div key={rep.id} className="flex items-center gap-3 py-2 border-b border-gray-100">
                  <label className={`flex items-center gap-2 flex-1 ${!active || isAdmin ? 'cursor-pointer' : 'cursor-default'}`}>
                    <input
                      type="checkbox"
                      checked={!!active}
                      disabled={!!active && !isAdmin}
                      onChange={() => toggleRepeater(rep.id)}
                      className="w-4 h-4 accent-red-600"
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
                <button onClick={() => addCustomRepeater(null)} className="bg-[#c8102e] hover:bg-[#a00d24] text-white px-3 py-1 rounded text-sm">Hinzufügen</button>
                <button onClick={() => setShowAddForm(null)} className="text-gray-500 text-sm hover:text-gray-700">Abbrechen</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowAddForm('simplex')} className="mt-2 text-sm text-red-700 hover:text-red-900 font-medium">
              + Simplex-Frequenz hinzufügen
            </button>
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-red-700 mb-2">Übung löschen?</h3>
            <p className="text-sm text-gray-700 mb-1">
              <span className="font-semibold">{exercise.name || 'Übung'}</span> vom {new Date(exercise.date + 'T00:00:00').toLocaleDateString('de-AT')}
            </p>
            <p className="text-sm text-gray-500 mb-4">
              Alle Rapporte, Teilnehmer und Umsetzer-Zuordnungen werden unwiderruflich gelöscht.
            </p>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-xs text-red-800 font-medium">Diese Aktion kann nicht rückgängig gemacht werden!</p>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                Abbrechen
              </button>
              <button
                onClick={async () => {
                  setDeleting(true);
                  try {
                    await apiFetch(`/api/v1/exercises/${id}`, { method: 'DELETE' });
                    navigate('/');
                  } catch {} finally {
                    setDeleting(false);
                  }
                }}
                disabled={deleting}
                className="px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg font-medium disabled:opacity-50"
              >
                {deleting ? 'Löschen...' : 'Endgültig löschen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
