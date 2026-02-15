import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiFetch } from '../services/api';
import { getSocket } from '../services/socket';
import LandMode from '../components/LandMode';
import BundMode from '../components/BundMode';
import RunningTotals from '../components/RunningTotals';

interface Stats {
  totalParticipants: number;
  totalReports: number;
  perRepeater: { short_name: string; count: number }[];
}

export default function ExercisePage() {
  const { id } = useParams<{ id: string }>();
  const [exercise, setExercise] = useState<any>(null);
  const [mode, setMode] = useState<'land' | 'bund'>('land');
  const [stats, setStats] = useState<Stats>({ totalParticipants: 0, totalReports: 0, perRepeater: [] });
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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

  if (loading) return <p className="text-gray-500 p-4">Laden...</p>;
  if (!exercise) return <p className="text-red-500 p-4">Übung nicht gefunden</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold text-[#5b3a1a]">
          {exercise.name || 'Übung'} — {new Date(exercise.date + 'T00:00:00').toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' })}
        </h1>
        <div className="flex items-center gap-2">
          <Link to={`/exercises/${id}/setup`} className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1 rounded text-sm">
            Einrichten
          </Link>
          <Link to={`/exercises/${id}/reports`} className="bg-amber-100 hover:bg-amber-200 text-amber-800 px-3 py-1 rounded text-sm">
            Auswertung
          </Link>
        </div>
      </div>

      <RunningTotals stats={stats} />

      <div className="flex gap-1 bg-white rounded-lg p-1 shadow-sm w-fit">
        <button
          onClick={() => setMode('land')}
          className={`px-4 py-1.5 rounded text-sm font-medium ${mode === 'land' ? 'bg-[#5b3a1a] text-white' : 'text-gray-600 hover:bg-gray-100'}`}
        >
          Land (Umsetzer)
        </button>
        <button
          onClick={() => setMode('bund')}
          className={`px-4 py-1.5 rounded text-sm font-medium ${mode === 'bund' ? 'bg-[#5b3a1a] text-white' : 'text-gray-600 hover:bg-gray-100'}`}
        >
          Bund (Bundesland)
        </button>
      </div>

      {mode === 'land' ? (
        <LandMode
          exerciseId={id!}
          repeaters={exercise.repeaters || []}
          reports={reports}
          onReportCreated={handleReportCreated}
          onReportUpdated={handleReportUpdated}
          onReportDeleted={handleReportDeleted}
        />
      ) : (
        <BundMode
          exerciseId={id!}
          repeaters={exercise.repeaters || []}
          reports={reports}
          onReportCreated={handleReportCreated}
          onReportUpdated={handleReportUpdated}
          onReportDeleted={handleReportDeleted}
        />
      )}
    </div>
  );
}
