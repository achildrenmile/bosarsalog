import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiFetch } from '../services/api';
import { getSocket } from '../services/socket';
import { useAuth } from '../hooks/useAuth';
import LandMode from '../components/LandMode';
import BundMode from '../components/BundMode';
import RunningTotals from '../components/RunningTotals';
import EmHamImport from '../components/EmHamImport';

interface Stats {
  totalParticipants: number;
  totalReports: number;
  perRepeater: { short_name: string; count: number }[];
}

export default function ExercisePage() {
  const { id } = useParams<{ id: string }>();
  const { admin } = useAuth();
  const isAdmin = admin?.role === 'admin';
  const [exercise, setExercise] = useState<any>(null);
  const [mode, setMode] = useState<'land' | 'bund'>('land');
  const [showImport, setShowImport] = useState(false);
  const oeLinkEnabled = exercise?.oe_link_enabled !== 0;
  const [stats, setStats] = useState<Stats>({ totalParticipants: 0, totalReports: 0, perRepeater: [] });
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [organisator, setOrganisator] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const socketRef = useRef(getSocket());

  const refreshStats = useCallback(async () => {
    if (!id) return;
    try {
      const s = await apiFetch(`/api/v1/exercises/${id}/stats`);
      setStats(s);
    } catch {}
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    apiFetch(`/api/v1/exercises/${id}`)
      .then(data => {
        setExercise(data);
        setReports(data.reports || []);
        if (data.organisator) setOrganisator(data.organisator);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    refreshStats();
  }, [id, refreshStats]);

  useEffect(() => {
    if (!id) return;
    const socket = socketRef.current;
    socket.emit('join_exercise', { exercise_id: id });

    socket.on('report_created', (data: any) => {
      setReports(prev => [data, ...prev]);
      refreshStats();
    });
    socket.on('report_updated', (data: any) => {
      setReports(prev => prev.map(r => r.id === data.id ? data : r));
      refreshStats();
    });
    socket.on('report_deleted', (data: any) => {
      setReports(prev => prev.filter(r => r.id !== data.report_id));
      refreshStats();
    });

    return () => {
      socket.emit('leave_exercise', { exercise_id: id });
      socket.off('report_created');
      socket.off('report_updated');
      socket.off('report_deleted');
    };
  }, [id, refreshStats]);

  const handleReportCreated = useCallback((report: any) => {
    setReports(prev => [report, ...prev]);
    socketRef.current.emit('report_created', { ...report, exercise_id: id! });
    refreshStats();
  }, [id, refreshStats]);

  const handleReportUpdated = useCallback((report: any) => {
    setReports(prev => prev.map(r => r.id === report.id ? report : r));
    socketRef.current.emit('report_updated', { ...report, exercise_id: id! });
    refreshStats();
  }, [id, refreshStats]);

  const handleReportDeleted = useCallback((reportId: number) => {
    setReports(prev => prev.filter(r => r.id !== reportId));
    socketRef.current.emit('report_deleted', { report_id: reportId, exercise_id: id! });
    refreshStats();
  }, [id, refreshStats]);

  const updateOrganisator = async (val: string) => {
    setSaveStatus('saving');
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    try {
      await apiFetch(`/api/v1/exercises/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ organisator: val || null }),
      });
      setExercise((prev: any) => prev ? { ...prev, organisator: val || null } : null);
      setSaveStatus('saved');
      savedTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('idle');
    }
  };

  if (loading) return <p className="text-gray-500 p-4">Laden...</p>;
  if (!exercise) return <p className="text-red-500 p-4">Übung nicht gefunden</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-base sm:text-xl font-bold text-[#1e3a5f] min-w-0">
          <span className="block sm:inline">{exercise.name || 'Übung'}</span>
          <span className="hidden sm:inline"> — </span>
          <span className="block sm:inline text-sm sm:text-xl">{new Date(exercise.date + 'T00:00:00').toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
        </h1>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <label className={`text-xs ${organisator ? 'text-gray-500' : 'text-[#c8102e] font-semibold'}`}>Organisator:</label>
            <input
              type="text"
              value={organisator}
              onChange={e => setOrganisator(e.target.value.toUpperCase())}
              onBlur={e => updateOrganisator(e.target.value.toUpperCase())}
              placeholder="Rufzeichen"
              className={`border rounded px-2 py-1 text-sm font-mono uppercase w-24 sm:w-28 focus:outline-none focus:ring-2 focus:ring-blue-500 ${organisator ? 'border-gray-300' : 'border-[#c8102e] placeholder-[#c8102e]/60'}`}
            />
            {saveStatus === 'saving' && <span className="text-xs text-amber-600 animate-pulse">Speichern...</span>}
            {saveStatus === 'saved' && <span className="text-xs text-green-600">Gespeichert</span>}
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowImport(true)}
              className="bg-emerald-100 hover:bg-emerald-200 text-emerald-800 px-2 sm:px-3 py-1 rounded text-xs sm:text-sm"
            >
              EmHam Import
            </button>
          )}
          <Link to={`/exercises/${id}/setup`} className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-2 sm:px-3 py-1 rounded text-xs sm:text-sm">
            Einrichten
          </Link>
          <Link to={`/exercises/${id}/reports`} className="bg-red-100 hover:bg-red-200 text-red-800 px-2 sm:px-3 py-1 rounded text-xs sm:text-sm">
            Auswertung
          </Link>
        </div>
      </div>

      <RunningTotals stats={stats} />

      {oeLinkEnabled && (
        <div className="flex gap-1 bg-white rounded-lg p-1 shadow-sm w-full sm:w-fit">
          <button
            onClick={() => setMode('land')}
            className={`flex-1 sm:flex-none px-3 sm:px-4 py-1.5 rounded text-xs sm:text-sm font-medium ${mode === 'land' ? 'bg-[#1e3a5f] text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            Frequenzen
          </button>
          <button
            onClick={() => setMode('bund')}
            className={`flex-1 sm:flex-none px-3 sm:px-4 py-1.5 rounded text-xs sm:text-sm font-medium ${mode === 'bund' ? 'bg-[#1e3a5f] text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            OE-Link
          </button>
        </div>
      )}

      {mode === 'land' || !oeLinkEnabled ? (
        <LandMode
          exerciseId={id!}
          repeaters={exercise.repeaters || []}
          reports={reports}
          simplexBezirke={!!exercise.simplex_bezirke}
          simplexBlCodes={exercise.simplex_bl_codes || ''}
          onReportCreated={handleReportCreated}
          onReportUpdated={handleReportUpdated}
          onReportDeleted={handleReportDeleted}
        />
      ) : (
        <BundMode
          exerciseId={id!}
          reports={reports}
          onReportCreated={handleReportCreated}
          onReportUpdated={handleReportUpdated}
          onReportDeleted={handleReportDeleted}
        />
      )}

      {showImport && (
        <EmHamImport
          exerciseId={id!}
          onClose={() => setShowImport(false)}
          onImported={(importedReports) => {
            for (const report of importedReports) {
              setReports(prev => [report, ...prev]);
              socketRef.current.emit('report_created', { ...report, exercise_id: id! });
            }
            refreshStats();
          }}
        />
      )}
    </div>
  );
}
