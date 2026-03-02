import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from '../services/api';
import { EXERCISE_TYPES, DEFAULT_EXERCISE_TYPE, getShortLabel } from '../constants/exerciseTypes';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, PointElement, LineElement,
  Title, Tooltip, Legend, Filler,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend, Filler);

interface ExerciseSummary {
  id: string;
  name: string | null;
  exercise_type: string | null;
  date: string;
  participant_count: number;
  report_count: number;
}

function getQuarter(date: string): number {
  const month = new Date(date + 'T00:00:00').getMonth();
  return Math.floor(month / 3) + 1;
}

export default function DashboardPage() {
  const { admin } = useAuth();
  const navigate = useNavigate();
  const [allExercises, setAllExercises] = useState<ExerciseSummary[]>([]);
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newDate, setNewDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [newType, setNewType] = useState(DEFAULT_EXERCISE_TYPE);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    apiFetch('/api/v1/exercises')
      .then(data => setAllExercises(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Derive available years and filter exercises
  const availableYears = [...new Set(allExercises.map(e => new Date(e.date + 'T00:00:00').getFullYear()))].sort();
  const yearExercises = allExercises.filter(e => new Date(e.date + 'T00:00:00').getFullYear() === selectedYear);
  const availableTypes = [...new Set(yearExercises.map(e => e.exercise_type || '').filter(Boolean))];
  const exercises = selectedTypes.size === 0
    ? yearExercises
    : yearExercises.filter(e => selectedTypes.has(e.exercise_type || ''));

  const formatDate = (d: string) => {
    const date = new Date(d + 'T00:00:00');
    return date.toLocaleDateString('de-AT', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  // Compute nearest exercise today or in the future
  const today = new Date().toISOString().split('T')[0];
  const futureExercises = exercises.filter(e => e.date >= today);
  const nearestId = futureExercises.length > 0
    ? futureExercises.reduce((closest, e) => {
        const dCur = new Date(e.date).getTime() - new Date(today).getTime();
        const dBest = new Date(closest.date).getTime() - new Date(today).getTime();
        return dCur < dBest ? e : closest;
      }, futureExercises[0]).id
    : null;

  // Compute quarterly and yearly totals
  const quarterTotals: Record<number, { participants: number; reports: number }> = {};
  let yearParticipants = 0;
  let yearReports = 0;

  for (const ex of exercises) {
    const q = getQuarter(ex.date);
    if (!quarterTotals[q]) quarterTotals[q] = { participants: 0, reports: 0 };
    quarterTotals[q].participants += ex.participant_count;
    quarterTotals[q].reports += ex.report_count;
    yearParticipants += ex.participant_count;
    yearReports += ex.report_count;
  }

  // Build rows with quarter subtotals inserted
  const buildRows = () => {
    const rows: { type: 'exercise' | 'quarter' | 'year'; data?: ExerciseSummary; quarter?: number; participants?: number; reports?: number }[] = [];
    let lastQuarter = 0;

    for (let i = 0; i < exercises.length; i++) {
      const ex = exercises[i];
      const q = getQuarter(ex.date);
      const nextEx = exercises[i + 1];
      const nextQ = nextEx ? getQuarter(nextEx.date) : 0;

      rows.push({ type: 'exercise', data: ex });

      // Insert quarter subtotal when quarter changes or at last exercise
      if (q !== nextQ && quarterTotals[q]) {
        rows.push({ type: 'quarter', quarter: q, ...quarterTotals[q] });
        lastQuarter = q;
      }
    }

    // Yearly total
    if (exercises.length > 0) {
      rows.push({ type: 'year', participants: yearParticipants, reports: yearReports });
    }

    return rows;
  };

  const QUARTER_LABELS: Record<number, string> = { 1: 'Q1 (Jan-Mär)', 2: 'Q2 (Apr-Jun)', 3: 'Q3 (Jul-Sep)', 4: 'Q4 (Okt-Dez)' };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 sm:mb-6 gap-2">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-[#1e3a5f]">Gesamtübersicht</h1>
          <p className="text-sm text-gray-500">Willkommen, {admin?.username}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {admin?.role === 'admin' && (
            <button
              onClick={() => setShowCreate(v => !v)}
              className="bg-[#c8102e] hover:bg-[#a00d24] text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              + Neue Übung
            </button>
          )}
        </div>
      </div>

      {/* Year + type filter */}
      {!loading && availableYears.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4 sm:mb-6">
          {availableYears.map(y => (
            <button
              key={y}
              onClick={() => { setSelectedYear(y); setSelectedTypes(new Set()); }}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                y === selectedYear
                  ? 'bg-[#1e3a5f] text-white'
                  : 'bg-gray-100 hover:bg-blue-100 text-gray-700 hover:text-[#1e3a5f]'
              }`}
            >
              {y}
            </button>
          ))}
          {availableTypes.length > 1 && (
            <>
              <span className="text-gray-300 mx-1">|</span>
              {availableTypes.map(type => (
                <label key={type} className="flex items-center gap-1.5 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={selectedTypes.has(type)}
                    onChange={() => {
                      setSelectedTypes(prev => {
                        const next = new Set(prev);
                        if (next.has(type)) next.delete(type); else next.add(type);
                        return next;
                      });
                    }}
                    className="w-3.5 h-3.5 accent-red-600"
                  />
                  <span className={selectedTypes.has(type) ? 'text-[#1e3a5f] font-medium' : 'text-gray-600'}>{getShortLabel(type)}</span>
                </label>
              ))}
              {selectedTypes.size > 0 && (
                <button onClick={() => setSelectedTypes(new Set())} className="text-xs text-gray-400 hover:text-gray-600">
                  Alle
                </button>
              )}
            </>
          )}
        </div>
      )}

      {showCreate && (
        <div className="bg-white rounded-xl shadow p-4 mb-6">
          <h2 className="text-sm sm:text-base font-semibold text-[#1e3a5f] mb-3">Neue Übung anlegen</h2>
          <div className="flex items-end gap-3 flex-wrap">
            <div className="w-full sm:w-auto">
              <label className="block text-sm text-gray-500 mb-1">Datum</label>
              <input
                type="date"
                value={newDate}
                onChange={e => setNewDate(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full sm:w-auto focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="w-full sm:w-auto">
              <label className="block text-sm text-gray-500 mb-1">Typ</label>
              <div className="flex gap-2">
                <select
                  value={EXERCISE_TYPES.some(t => t.value === newType) ? newType : '__custom__'}
                  onChange={e => {
                    if (e.target.value === '__custom__') setNewType('');
                    else setNewType(e.target.value);
                  }}
                  className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {EXERCISE_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                  <option value="__custom__">Eigener Typ...</option>
                </select>
                {!EXERCISE_TYPES.some(t => t.value === newType) && (
                  <input
                    type="text"
                    value={newType}
                    onChange={e => setNewType(e.target.value)}
                    placeholder="Typ eingeben"
                    className="border border-gray-300 rounded px-2 py-1.5 text-sm flex-1 min-w-[140px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                )}
              </div>
            </div>
            <div className="flex-1 min-w-0 w-full sm:w-auto">
              <label className="block text-sm text-gray-500 mb-1">Name (optional)</label>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="z.B. Sonntagsrunde KW 07"
                className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              disabled={creating || !newDate || !newType}
              onClick={async () => {
                setCreating(true);
                try {
                  const ex = await apiFetch('/api/v1/exercises', {
                    method: 'POST',
                    body: JSON.stringify({ date: newDate, name: newName || `${newType} ${newDate}`, exercise_type: newType }),
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

      {/* Summary cards */}
      {!loading && exercises.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-6">
          <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4 text-center">
            <div className="text-2xl sm:text-3xl font-bold text-[#1e3a5f]">{exercises.length}</div>
            <div className="text-sm text-gray-500">Übungen</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4 text-center">
            <div className="text-2xl sm:text-3xl font-bold text-[#1e3a5f]">{yearParticipants}</div>
            <div className="text-sm text-gray-500">Teilnehmer gesamt</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4 text-center">
            <div className="text-2xl sm:text-3xl font-bold text-[#1e3a5f]">{yearReports}</div>
            <div className="text-sm text-gray-500">Rapporte gesamt</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4 text-center">
            <div className="text-2xl sm:text-3xl font-bold text-gray-600">
              {exercises.length > 0 ? Math.round(yearParticipants / exercises.filter(e => e.participant_count > 0).length || 1) : 0}
            </div>
            <div className="text-sm text-gray-500">Teilnehmer/Übung</div>
          </div>
        </div>
      )}

      {/* Trend chart */}
      {!loading && exercises.length > 0 && (
        <div className="bg-white rounded-xl shadow p-4 mb-6">
          <h2 className="text-sm sm:text-base font-semibold text-[#1e3a5f] mb-3">BOS-ARSA Übungen {selectedYear}</h2>
          <div className="h-48 sm:h-[300px]">
            <Bar
              data={{
                labels: exercises.map(e => {
                  const d = new Date(e.date + 'T00:00:00');
                  return d.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit' });
                }),
                datasets: [
                  {
                    label: 'Teilnehmer',
                    data: exercises.map(e => e.participant_count),
                    backgroundColor: '#1e3a5f',
                  },
                  {
                    label: 'Rapporte',
                    data: exercises.map(e => e.report_count),
                    backgroundColor: '#c8102e',
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { position: 'bottom' },
                },
                scales: {
                  y: { beginAtZero: true },
                },
              }}
            />
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Laden...</p>
      ) : exercises.length === 0 ? (
        <p className="text-gray-500">Keine Übungen in {selectedYear}.</p>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-x-auto">
          <table className="w-full text-sm min-w-[480px]">
            <thead className="bg-[#1e3a5f] text-white">
              <tr>
                <th className="px-2 sm:px-4 py-2 text-left">Datum</th>
                <th className="px-2 sm:px-4 py-2 text-left hidden sm:table-cell">Typ</th>
                <th className="px-2 sm:px-4 py-2 text-left hidden md:table-cell">Name</th>
                <th className="px-2 sm:px-4 py-2 text-right">Teiln.</th>
                <th className="px-2 sm:px-4 py-2 text-right">Rapp.</th>
                <th className="px-2 sm:px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {buildRows().map((row, idx) => {
                if (row.type === 'exercise') {
                  const ex = row.data!;
                  const isNearest = ex.id === nearestId;
                  return (
                    <tr key={ex.id} className={`border-t ${isNearest ? 'bg-blue-100 font-medium' : 'hover:bg-blue-50'}`}>
                      <td className="px-2 sm:px-4 py-2 font-mono text-sm">
                        {formatDate(ex.date)}
                        {isNearest && <span className="ml-1 sm:ml-2 text-[10px] sm:text-xs bg-[#c8102e] text-white px-1 sm:px-1.5 py-0.5 rounded">Aktuell</span>}
                      </td>
                      <td className="px-2 sm:px-4 py-2 text-gray-700 hidden sm:table-cell">{getShortLabel(ex.exercise_type || '')}</td>
                      <td className="px-2 sm:px-4 py-2 text-gray-700 hidden md:table-cell">{ex.name || '—'}</td>
                      <td className="px-2 sm:px-4 py-2 text-right">{ex.participant_count}</td>
                      <td className="px-2 sm:px-4 py-2 text-right">{ex.report_count}</td>
                      <td className="px-2 sm:px-4 py-2 text-right space-x-1 sm:space-x-2">
                        <Link to={`/exercises/${ex.id}`} className="text-blue-700 hover:underline text-xs">
                          Öffnen
                        </Link>
                        <Link to={`/exercises/${ex.id}/reports`} className="text-blue-600 hover:underline text-xs hidden sm:inline">
                          Auswertung
                        </Link>
                      </td>
                    </tr>
                  );
                }
                if (row.type === 'quarter') {
                  return (
                    <tr key={`q${row.quarter}`} className="bg-blue-50 font-semibold border-t-2 border-blue-200">
                      <td className="px-2 sm:px-4 py-1.5 text-blue-800 text-xs" colSpan={1}>
                        {QUARTER_LABELS[row.quarter!]}
                      </td>
                      <td className="px-2 sm:px-4 py-1.5 hidden sm:table-cell"></td>
                      <td className="px-2 sm:px-4 py-1.5 hidden md:table-cell"></td>
                      <td className="px-2 sm:px-4 py-1.5 text-right text-blue-800">{row.participants}</td>
                      <td className="px-2 sm:px-4 py-1.5 text-right text-blue-800">{row.reports}</td>
                      <td></td>
                    </tr>
                  );
                }
                if (row.type === 'year') {
                  return (
                    <tr key="year" className="bg-[#1e3a5f] text-white font-bold">
                      <td className="px-2 sm:px-4 py-2">Gesamt {selectedYear}</td>
                      <td className="px-2 sm:px-4 py-2 hidden sm:table-cell"></td>
                      <td className="px-2 sm:px-4 py-2 hidden md:table-cell"></td>
                      <td className="px-2 sm:px-4 py-2 text-right">{row.participants}</td>
                      <td className="px-2 sm:px-4 py-2 text-right">{row.reports}</td>
                      <td></td>
                    </tr>
                  );
                }
                return null;
              })}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}
