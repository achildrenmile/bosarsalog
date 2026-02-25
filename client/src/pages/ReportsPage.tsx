import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiFetch } from '../services/api';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement,
  ArcElement, PointElement, LineElement,
  Title, Tooltip, Legend,
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';
import { toPng } from 'html-to-image';
import AustriaMap from '../components/AustriaMap';
import type { BezirkStat, Stats } from '../types/stats';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Title, Tooltip, Legend);

export default function ReportsPage() {
  const { id } = useParams<{ id: string }>();
  const [exercise, setExercise] = useState<any>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showParticipants, setShowParticipants] = useState(true);
  const barChartRef = useRef<any>(null);
  const pieChartRef = useRef<any>(null);
  const barCardRef = useRef<HTMLDivElement>(null);
  const pieCardRef = useRef<HTMLDivElement>(null);
  const mapCardRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const createExportHeader = () => {
    const header = document.createElement('div');
    header.setAttribute('data-export-inject', 'true');
    header.style.cssText = 'display:flex;align-items:center;gap:12px;padding:16px 24px;background:#1e3a5f;border-radius:8px;margin-bottom:16px;';
    const img = document.createElement('img');
    img.src = '/bosarsa.jpeg';
    img.style.cssText = 'height:36px;border-radius:4px;';
    header.appendChild(img);
    const text = document.createElement('div');
    const title = document.createElement('div');
    title.textContent = 'BOS-ARSA Log';
    title.style.cssText = 'font-size:16px;font-weight:bold;color:#ffffff;letter-spacing:0.5px;';
    text.appendChild(title);
    const sub = document.createElement('div');
    sub.textContent = 'Im Sinne der Sicherheit';
    sub.style.cssText = 'font-size:10px;color:#93c5fd;letter-spacing:1px;';
    text.appendChild(sub);
    header.appendChild(text);
    return header;
  };

  const createExportFooter = () => {
    const footer = document.createElement('div');
    footer.setAttribute('data-export-inject', 'true');
    footer.style.cssText = 'text-align:center;padding:12px 0;margin-top:16px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;';
    footer.textContent = 'oeradio.at  \u00B7  bosarsa.oeradio.at';
    return footer;
  };

  const downloadChart = async (cardRef: React.RefObject<HTMLDivElement | null>, filename: string) => {
    if (!cardRef.current || !exercise) return;
    setExporting(true);
    const header = createExportHeader();
    const footer = createExportFooter();
    // Wrap the card temporarily
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'padding:24px;background:#f3f4f6;';
    const parent = cardRef.current.parentNode!;
    const next = cardRef.current.nextSibling;
    parent.insertBefore(wrapper, cardRef.current);
    wrapper.appendChild(header);
    wrapper.appendChild(cardRef.current);
    wrapper.appendChild(footer);
    try {
      const url = await toPng(wrapper, { backgroundColor: '#f3f4f6', pixelRatio: 2 });
      const link = document.createElement('a');
      link.download = filename;
      link.href = url;
      link.click();
    } catch {} finally {
      // Move card back to original position
      if (next) parent.insertBefore(cardRef.current, next); else parent.appendChild(cardRef.current);
      wrapper.remove();
      setExporting(false);
    }
  };

  const downloadFullPage = async () => {
    if (!exercise) return;
    setExporting(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/v1/pdf/exercises/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `BOS-ARSA_Auswertung_${exercise.date}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {} finally {
      setExporting(false);
    }
  };

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
    <div ref={pageRef} className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-base sm:text-xl font-bold text-[#1e3a5f]">Auswertung</h1>
          <p className="text-xs sm:text-sm text-gray-500 truncate">{exercise.name} — {formatDate(exercise.date)}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0" data-no-export="true">
          <button
            onClick={downloadFullPage}
            disabled={exporting}
            className="bg-[#1e3a5f] hover:bg-[#2a4a7f] text-white px-2 sm:px-3 py-1.5 rounded text-xs sm:text-sm disabled:opacity-50"
          >
            {exporting ? 'Exportieren...' : 'Download Auswertung'}
          </button>
          <Link to={`/exercises/${id}`} className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-2 sm:px-3 py-1.5 rounded text-xs sm:text-sm">
            Zurück
          </Link>
        </div>
      </div>

      {stats && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
            <div className="bg-white rounded-lg shadow-sm p-2 sm:p-4 text-center">
              <div className="text-2xl sm:text-3xl font-bold text-[#1e3a5f]">{stats.totalParticipants}</div>
              <div className="text-xs sm:text-sm text-gray-500">Teilnehmer</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-2 sm:p-4 text-center">
              <div className="text-2xl sm:text-3xl font-bold text-[#1e3a5f]">{stats.totalReports}</div>
              <div className="text-xs sm:text-sm text-gray-500">Rapporte</div>
            </div>
            {stats.perRepeater.map((r) => (
              <div key={r.short_name} className="bg-white rounded-lg shadow-sm p-2 sm:p-4 text-center">
                <div className="text-xl sm:text-2xl font-bold text-gray-700">{r.count}</div>
                <div className="text-xs text-gray-500 truncate">{r.short_name}</div>
              </div>
            ))}
          </div>

          {/* Austria Map */}
          {stats.blStats.length > 0 && (
            <div ref={mapCardRef} className="bg-white rounded-xl shadow p-3 sm:p-4">
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <h2 className="text-xs sm:text-sm font-semibold text-[#1e3a5f]">
                  Teilnehmer nach Bundesland / Land
                </h2>
                <button
                  onClick={() => downloadChart(mapCardRef, `BOS-ARSA_Karte_${exercise.date}.png`)}
                  className="text-xs text-gray-400 hover:text-blue-600 flex-shrink-0 ml-2"
                  title="Karte als PNG herunterladen"
                  data-no-export="true"
                >
                  Download
                </button>
              </div>
              <AustriaMap
                data={stats.blStats.map((bl) => ({
                  code: bl.bundesland_code,
                  participants: bl.participants,
                  reports: bl.reports,
                }))}
              />
            </div>
          )}

          {/* Charts */}
          {(() => {
            // Use bezirkStats if available, otherwise fall back to blStats (Bundesland level)
            const chartData = stats.bezirkStats.length > 0
              ? stats.bezirkStats.map(bz => ({ label: `OE${parseInt(bz.bundesland_code, 10)} ${bz.bezirk_code}`, participants: bz.participants, reports: bz.reports }))
              : stats.blStats.map(bl => ({ label: `OE${parseInt(bl.bundesland_code, 10)}`, participants: bl.participants, reports: bl.reports }));
            const chartLevel = stats.bezirkStats.length > 0 ? 'Bezirk' : 'Bundesland';

            return chartData.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Bar chart: Stationen + Rapporte */}
              <div ref={barCardRef} className="bg-white rounded-xl shadow p-3 sm:p-4">
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <h2 className="text-xs sm:text-sm font-semibold text-[#1e3a5f]">
                    BOS-ARSA Übung am {new Date(exercise.date + 'T00:00:00').toLocaleDateString('de-AT')}
                  </h2>
                  <button
                    onClick={() => downloadChart(barCardRef, `BOS-ARSA_Stationen_${exercise.date}.png`)}
                    className="text-xs text-gray-400 hover:text-blue-600 flex-shrink-0 ml-2"
                    title="Grafik als PNG herunterladen"
                    data-no-export="true"
                  >
                    Download
                  </button>
                </div>
                <div className="h-48 sm:h-[350px]">
                  <Bar
                    ref={barChartRef}
                    data={{
                      labels: chartData.map(d => d.label),
                      datasets: [
                        {
                          label: 'Stationen',
                          data: chartData.map(d => d.participants),
                          backgroundColor: '#1e3a5f',
                        },
                        {
                          label: 'Rapporte',
                          data: chartData.map(d => d.reports),
                          backgroundColor: '#c8102e',
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
              <div ref={pieCardRef} className="bg-white rounded-xl shadow p-3 sm:p-4">
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <h2 className="text-xs sm:text-sm font-semibold text-[#1e3a5f]">
                    Rapporte Verteilung nach Bundesland / Land
                  </h2>
                  <button
                    onClick={() => downloadChart(pieCardRef, `BOS-ARSA_Verteilung_${exercise.date}.png`)}
                    className="text-xs text-gray-400 hover:text-blue-600 flex-shrink-0 ml-2"
                    title="Grafik als PNG herunterladen"
                    data-no-export="true"
                  >
                    Download
                  </button>
                </div>
                <div className="h-48 sm:h-[350px] flex items-center justify-center">
                  <Pie
                    ref={pieChartRef}
                    data={{
                      labels: chartData.filter(d => d.reports > 0).map(d => d.label),
                      datasets: [{
                        data: chartData.filter(d => d.reports > 0).map(d => d.reports),
                        backgroundColor: [
                          '#1e3a5f', '#c8102e', '#d97706', '#0d6efd', '#198754',
                          '#6f42c1', '#fd7e14', '#20c997', '#0dcaf0', '#6c757d',
                          '#2c5282', '#e8a317', '#c70039', '#4361ee', '#2d6a4f',
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
          ) : null;
          })()}

          {/* Bundesland table (when no bezirk data) */}
          {stats.bezirkStats.length === 0 && stats.blStats.length > 0 && (
            <div className="bg-white rounded-xl shadow overflow-hidden">
              <div className="bg-[#1e3a5f] text-white px-4 py-2 text-sm font-semibold">
                Teilnehmer nach Bundesland / Land
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b text-left text-xs text-gray-500 uppercase">
                    <th className="px-4 py-2">Bundesland</th>
                    <th className="px-4 py-2 text-right w-28">Teilnehmer</th>
                    <th className="px-4 py-2 text-right w-28">Rapporte</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.blStats.map(bl => (
                    <tr key={bl.bundesland_code} className="border-t hover:bg-blue-50">
                      <td className="px-4 py-1.5 font-medium">{bl.bundesland}</td>
                      <td className="px-4 py-1.5 text-right">{bl.participants}</td>
                      <td className="px-4 py-1.5 text-right">{bl.reports}</td>
                    </tr>
                  ))}
                  <tr className="bg-[#1e3a5f] text-white font-bold">
                    <td className="px-4 py-2">Gesamt</td>
                    <td className="px-4 py-2 text-right">{stats.totalParticipants}</td>
                    <td className="px-4 py-2 text-right">{stats.totalReports}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Bezirk/Bundesland table */}
          {stats.bezirkStats.length > 0 && (
            <div className="bg-white rounded-xl shadow overflow-hidden">
              <div className="bg-[#1e3a5f] text-white px-2 sm:px-4 py-2 text-xs sm:text-sm font-semibold">
                Nebenstationen nach Bezirk
              </div>
              <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm min-w-[360px]">
                <thead>
                  <tr className="bg-gray-50 border-b text-left text-xs text-gray-500 uppercase">
                    <th className="px-2 sm:px-4 py-2">Bundesland / Bezirk</th>
                    <th className="px-2 sm:px-4 py-2 text-right w-16 sm:w-28">Teiln.</th>
                    <th className="px-2 sm:px-4 py-2 text-right w-16 sm:w-28">Rapp.</th>
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
                        <tr key={bz.bezirk_code} className="border-t border-gray-100 hover:bg-blue-50">
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
                  <tr className="bg-[#1e3a5f] text-white font-bold">
                    <td className="px-4 py-2">Gesamt</td>
                    <td className="px-4 py-2 text-right">{stats.totalParticipants}</td>
                    <td className="px-4 py-2 text-right">{stats.totalReports}</td>
                  </tr>
                </tbody>
              </table>
              </div>
            </div>
          )}

          {/* Participants list */}
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <div
              onClick={() => setShowParticipants(v => !v)}
              className="bg-[#1e3a5f] text-white px-4 py-2 text-sm font-semibold cursor-pointer hover:bg-[#2a4a7f] flex items-center justify-between"
            >
              <span>Teilnehmer-Liste ({stats.participants.length})</span>
              <span className="text-xs">{showParticipants ? '▼' : '▶'}</span>
            </div>
            {showParticipants && (
              <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm min-w-[360px]">
                <thead>
                  <tr className="bg-gray-50 border-b text-left text-xs text-gray-500 uppercase">
                    <th className="px-2 sm:px-4 py-2 w-8">#</th>
                    <th className="px-2 sm:px-4 py-2">Rufzeichen</th>
                    <th className="px-2 sm:px-4 py-2 hidden sm:table-cell">Name</th>
                    <th className="px-2 sm:px-4 py-2">Bezirk</th>
                    <th className="px-2 sm:px-4 py-2 hidden md:table-cell">Bundesland / Land</th>
                    <th className="px-2 sm:px-4 py-2 text-right w-16 sm:w-24">Rapp.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {stats.participants.map((p, idx) => (
                    <tr key={p.callsign} className="hover:bg-blue-50">
                      <td className="px-2 sm:px-4 py-1 text-xs text-gray-400">{idx + 1}</td>
                      <td className="px-2 sm:px-4 py-1 font-mono font-medium">{p.callsign}{p.suffixes ? p.suffixes.split(',').filter(Boolean).map(s => s.startsWith('/') ? s : `/${s}`).join('') : ''}</td>
                      <td className="px-2 sm:px-4 py-1 text-gray-600 hidden sm:table-cell">{p.name || ''}</td>
                      <td className="px-2 sm:px-4 py-1">
                        {p.bezirk_code && (
                          <span className="text-xs bg-gray-200 rounded px-1.5 py-0.5 font-mono">{p.bezirk_code}</span>
                        )}
                      </td>
                      <td className="px-2 sm:px-4 py-1 text-gray-600 text-xs hidden md:table-cell">{p.bundesland_name || ''}</td>
                      <td className="px-2 sm:px-4 py-1 text-right font-mono">{p.report_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>

          {/* Export buttons */}
          <div className="bg-white rounded-xl shadow p-4" data-no-export="true">
            <h2 className="text-sm font-semibold text-[#1e3a5f] mb-3">Export</h2>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={downloadFullPage}
                disabled={exporting}
                className="bg-[#1e3a5f] hover:bg-[#2a4a7f] text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
              >
                {exporting ? 'Exportieren...' : 'PDF — Download Auswertung'}
              </button>
              {exercise.oe_link_enabled !== 0 && (
                <a
                  href={`/api/v1/export/exercises/${id}/bund`}
                  className="bg-red-100 hover:bg-red-200 text-red-800 px-4 py-2 rounded text-sm font-medium"
                  target="_blank"
                >
                  TXT — OE-Link
                </a>
              )}
              <a
                href={`/api/v1/export/exercises/${id}/land`}
                className="bg-red-100 hover:bg-red-200 text-red-800 px-4 py-2 rounded text-sm font-medium"
                target="_blank"
              >
                TXT — Frequenzen
              </a>
              <a
                href={`/api/v1/export/exercises/${id}/combined`}
                className="bg-red-100 hover:bg-red-200 text-red-800 px-4 py-2 rounded text-sm font-medium"
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
