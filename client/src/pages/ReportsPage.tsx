import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiFetch } from '../services/api';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement,
  ArcElement, PointElement, LineElement,
  Title, Tooltip, Legend,
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Title, Tooltip, Legend);

interface BezirkStat {
  bundesland: string;
  bundesland_code: string;
  bezirk_code: string;
  bezirk_name: string;
  is_capital: number;
  participants: number;
  reports: number;
}

interface Participant {
  callsign: string;
  name: string | null;
  bezirk_code: string | null;
  bundesland_code: string | null;
  bundesland_name: string | null;
  report_count: number;
}

interface RepeaterStat {
  short_name: string;
  count: number;
}

interface Stats {
  totalParticipants: number;
  totalReports: number;
  perRepeater: RepeaterStat[];
  bezirkStats: BezirkStat[];
  participants: Participant[];
}

export default function ReportsPage() {
  const { id } = useParams<{ id: string }>();
  const [exercise, setExercise] = useState<any>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showParticipants, setShowParticipants] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      apiFetch(`/api/v1/exercises/${id}`),
      apiFetch(`/api/v1/exercises/${id}/stats`),
    ]).then(([ex, st]) => {
      setExercise(ex);
      setStats(st);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="text-gray-500">Laden...</p>;
  if (!exercise) return <p className="text-red-500">Nicht gefunden</p>;

  // Group bezirk stats by Bundesland
  const byBl: Record<string, { name: string; bezirke: BezirkStat[]; totalParticipants: number; totalReports: number }> = {};
  if (stats) {
    for (const bz of stats.bezirkStats) {
      if (!byBl[bz.bundesland_code]) {
        byBl[bz.bundesland_code] = { name: bz.bundesland, bezirke: [], totalParticipants: 0, totalReports: 0 };
      }
      byBl[bz.bundesland_code].bezirke.push(bz);
      byBl[bz.bundesland_code].totalParticipants += bz.participants;
      byBl[bz.bundesland_code].totalReports += bz.reports;
    }
  }

  const formatDate = (d: string) => {
    const date = new Date(d + 'T00:00:00');
    return date.toLocaleDateString('de-AT', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#5b3a1a]">Auswertung</h1>
          <p className="text-sm text-gray-500">{exercise.name} — {formatDate(exercise.date)}</p>
        </div>
        <Link to={`/exercises/${id}`} className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1.5 rounded text-sm">
          Zurück
        </Link>
      </div>

      {stats && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white rounded-lg shadow-sm p-4 text-center">
              <div className="text-3xl font-bold text-[#5b3a1a]">{stats.totalParticipants}</div>
              <div className="text-sm text-gray-500">Teilnehmer</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4 text-center">
              <div className="text-3xl font-bold text-[#5b3a1a]">{stats.totalReports}</div>
              <div className="text-sm text-gray-500">Rapporte</div>
            </div>
            {stats.perRepeater.map((r) => (
              <div key={r.short_name} className="bg-white rounded-lg shadow-sm p-4 text-center">
                <div className="text-2xl font-bold text-gray-700">{r.count}</div>
                <div className="text-xs text-gray-500">{r.short_name}</div>
              </div>
            ))}
          </div>

          {/* Charts */}
          {stats.bezirkStats.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Bar chart: Stationen + Rapporte per Bezirk */}
              <div className="bg-white rounded-xl shadow p-4">
                <h2 className="text-sm font-semibold text-[#5b3a1a] mb-3">
                  BOS-ARSA Krisenkommunikationsübung am {new Date(exercise.date + 'T00:00:00').toLocaleDateString('de-AT')}
                </h2>
                <div style={{ height: 350 }}>
                  <Bar
                    data={{
                      labels: stats.bezirkStats.map(bz => `${bz.bundesland} ${bz.bezirk_code}`),
                      datasets: [
                        {
                          label: 'Stationen',
                          data: stats.bezirkStats.map(bz => bz.participants),
                          backgroundColor: '#5b3a1a',
                        },
                        {
                          label: 'Rapporte',
                          data: stats.bezirkStats.map(bz => bz.reports),
                          backgroundColor: '#d97706',
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { position: 'bottom' } },
                      scales: {
                        x: { ticks: { maxRotation: 90, minRotation: 45, font: { size: 9 } } },
                        y: { beginAtZero: true },
                      },
                    }}
                  />
                </div>
              </div>

              {/* Pie chart: Rapporte distribution */}
              <div className="bg-white rounded-xl shadow p-4">
                <h2 className="text-sm font-semibold text-[#5b3a1a] mb-3">
                  Rapporte-Verteilung nach Bezirk
                </h2>
                <div style={{ height: 350 }} className="flex items-center justify-center">
                  <Pie
                    data={{
                      labels: stats.bezirkStats.filter(bz => bz.reports > 0).map(bz => `${bz.bundesland} ${bz.bezirk_code}`),
                      datasets: [{
                        data: stats.bezirkStats.filter(bz => bz.reports > 0).map(bz => bz.reports),
                        backgroundColor: [
                          '#5b3a1a', '#d97706', '#dc3545', '#0d6efd', '#198754',
                          '#6f42c1', '#fd7e14', '#20c997', '#0dcaf0', '#6c757d',
                          '#8b5a2b', '#e8a317', '#c70039', '#4361ee', '#2d6a4f',
                          '#9b59b6', '#e67e22', '#1abc9c', '#3498db', '#95a5a6',
                        ],
                      }],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { position: 'right', labels: { font: { size: 10 } } },
                      },
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Bezirk/Bundesland table */}
          {stats.bezirkStats.length > 0 && (
            <div className="bg-white rounded-xl shadow overflow-hidden">
              <div className="bg-[#5b3a1a] text-white px-4 py-2 text-sm font-semibold">
                Nebenstationen nach Bezirk
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b text-left text-xs text-gray-500 uppercase">
                    <th className="px-4 py-2">Bundesland / Bezirk</th>
                    <th className="px-4 py-2 text-right w-28">Teilnehmer</th>
                    <th className="px-4 py-2 text-right w-28">Rapporte</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(byBl).map(([blCode, bl]) => (
                    <>
                      {/* Bundesland header */}
                      <tr key={`bl-${blCode}`} className="bg-gray-50 font-medium border-t">
                        <td className="px-4 py-1.5">{bl.name}</td>
                        <td className="px-4 py-1.5 text-right font-bold">{bl.totalParticipants}</td>
                        <td className="px-4 py-1.5 text-right font-bold">{bl.totalReports}</td>
                      </tr>
                      {/* Bezirk rows */}
                      {bl.bezirke.map(bz => (
                        <tr key={bz.bezirk_code} className="border-t border-gray-100 hover:bg-amber-50">
                          <td className="px-4 py-1 pl-8">
                            <span className={`inline-block text-xs font-mono px-1.5 py-0.5 rounded text-white mr-2 ${bz.is_capital ? 'bg-[#dc3545]' : 'bg-[#6c757d]'}`}>
                              {bz.bezirk_code}
                            </span>
                            <span className="text-gray-600">{bz.bezirk_name}</span>
                          </td>
                          <td className="px-4 py-1 text-right">{bz.participants}</td>
                          <td className="px-4 py-1 text-right">{bz.reports}</td>
                        </tr>
                      ))}
                    </>
                  ))}
                  {/* Gesamt */}
                  <tr className="bg-[#5b3a1a] text-white font-bold">
                    <td className="px-4 py-2">Gesamt</td>
                    <td className="px-4 py-2 text-right">{stats.totalParticipants}</td>
                    <td className="px-4 py-2 text-right">{stats.totalReports}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Participants list */}
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <div
              onClick={() => setShowParticipants(v => !v)}
              className="bg-[#5b3a1a] text-white px-4 py-2 text-sm font-semibold cursor-pointer hover:bg-[#7a5230] flex items-center justify-between"
            >
              <span>Teilnehmer-Liste ({stats.participants.length})</span>
              <span className="text-xs">{showParticipants ? '▼' : '▶'}</span>
            </div>
            {showParticipants && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b text-left text-xs text-gray-500 uppercase">
                    <th className="px-4 py-2 w-8">#</th>
                    <th className="px-4 py-2">Rufzeichen</th>
                    <th className="px-4 py-2">Name</th>
                    <th className="px-4 py-2">Bezirk</th>
                    <th className="px-4 py-2">Bundesland</th>
                    <th className="px-4 py-2 text-right w-24">Rapporte</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {stats.participants.map((p, idx) => (
                    <tr key={p.callsign} className="hover:bg-amber-50">
                      <td className="px-4 py-1 text-xs text-gray-400">{idx + 1}</td>
                      <td className="px-4 py-1 font-mono font-medium">{p.callsign}</td>
                      <td className="px-4 py-1 text-gray-600">{p.name || ''}</td>
                      <td className="px-4 py-1">
                        {p.bezirk_code && (
                          <span className="text-xs bg-gray-200 rounded px-1.5 py-0.5 font-mono">{p.bezirk_code}</span>
                        )}
                      </td>
                      <td className="px-4 py-1 text-gray-600 text-xs">{p.bundesland_name || ''}</td>
                      <td className="px-4 py-1 text-right font-mono">{p.report_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Export buttons */}
          <div className="bg-white rounded-xl shadow p-4">
            <h2 className="text-sm font-semibold text-[#5b3a1a] mb-3">Export</h2>
            <div className="flex flex-wrap gap-3">
              <a
                href={`/api/v1/export/exercises/${id}/bund`}
                className="bg-amber-100 hover:bg-amber-200 text-amber-800 px-4 py-2 rounded text-sm font-medium"
                target="_blank"
              >
                TXT — Bund
              </a>
              <a
                href={`/api/v1/export/exercises/${id}/land`}
                className="bg-amber-100 hover:bg-amber-200 text-amber-800 px-4 py-2 rounded text-sm font-medium"
                target="_blank"
              >
                TXT — Land
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
        </>
      )}
    </div>
  );
}
