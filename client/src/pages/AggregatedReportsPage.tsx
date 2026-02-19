import { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../services/api';
import { EXERCISE_TYPES, getShortLabel } from '../constants/exerciseTypes';
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

interface ExerciseSummary {
  id: string;
  date: string;
  name: string;
  exercise_type: string | null;
  participant_count: number;
  report_count: number;
}

interface AggregatedResponse {
  exercises: ExerciseSummary[];
  stats: Stats;
}

const PIE_COLORS = [
  '#1e3a5f', '#c8102e', '#d97706', '#0d6efd', '#198754',
  '#6f42c1', '#fd7e14', '#20c997', '#0dcaf0', '#6c757d',
  '#2c5282', '#e8a317', '#c70039', '#4361ee', '#2d6a4f',
  '#9b59b6', '#e67e22', '#1abc9c', '#3498db', '#95a5a6',
];

function formatDateDE(d: string) {
  const date = new Date(d + 'T00:00:00');
  return date.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function toISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function AggregatedReportsPage() {
  const now = new Date();
  const year = now.getFullYear();

  const [from, setFrom] = useState(() => toISO(new Date(year, 0, 1)));
  const [to, setTo] = useState(() => toISO(new Date(year, 11, 31)));
  const [data, setData] = useState<AggregatedResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [showExercises, setShowExercises] = useState(false);
  const [showParticipants, setShowParticipants] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());

  const barChartRef = useRef<any>(null);
  const pieChartRef = useRef<any>(null);
  const barCardRef = useRef<HTMLDivElement>(null);
  const pieCardRef = useRef<HTMLDivElement>(null);
  const mapCardRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  const fetchStats = (f: string, t: string, types?: Set<string>) => {
    setLoading(true);
    const typesParam = types && types.size > 0 ? `&types=${Array.from(types).map(encodeURIComponent).join(',')}` : '';
    apiFetch(`/api/v1/reports/stats?from=${f}&to=${t}${typesParam}`)
      .then((res) => setData(res))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchStats(from, to, selectedTypes);
  }, []);

  const applyRange = (f: string, t: string) => {
    setFrom(f);
    setTo(t);
    fetchStats(f, t, selectedTypes);
  };

  const applyQuarter = (q: number) => {
    const start = new Date(year, (q - 1) * 3, 1);
    const end = new Date(year, q * 3, 0);
    applyRange(toISO(start), toISO(end));
  };

  const applyYear = () => {
    applyRange(toISO(new Date(year, 0, 1)), toISO(new Date(year, 11, 31)));
  };

  const handleFromChange = (v: string) => {
    setFrom(v);
    fetchStats(v, to, selectedTypes);
  };

  const handleToChange = (v: string) => {
    setTo(v);
    fetchStats(from, v, selectedTypes);
  };

  const toggleType = (type: string) => {
    setSelectedTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      fetchStats(from, to, next);
      return next;
    });
  };

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
    if (!cardRef.current) return;
    setExporting(true);
    const header = createExportHeader();
    const footer = createExportFooter();
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
      if (next) parent.insertBefore(cardRef.current, next); else parent.appendChild(cardRef.current);
      wrapper.remove();
      setExporting(false);
    }
  };

  const downloadFullPage = async () => {
    if (!pageRef.current) return;
    setExporting(true);
    const header = createExportHeader();
    const footer = createExportFooter();
    pageRef.current.style.padding = '24px';
    pageRef.current.insertBefore(header, pageRef.current.firstChild);
    pageRef.current.appendChild(footer);
    try {
      const url = await toPng(pageRef.current, {
        backgroundColor: '#f3f4f6',
        pixelRatio: 2,
        filter: (node) => {
          if (node instanceof HTMLElement && node.dataset.noExport === 'true') return false;
          return true;
        },
      });
      const link = document.createElement('a');
      link.download = `BOS-ARSA_Auswertung_${from}_${to}.png`;
      link.href = url;
      link.click();
    } catch {} finally {
      header.remove();
      footer.remove();
      if (pageRef.current) pageRef.current.style.padding = '';
      setExporting(false);
    }
  };

  const stats = data?.stats ?? null;
  const exercises = data?.exercises ?? [];

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

  const avgParticipants = exercises.length > 0
    ? Math.round((stats?.totalParticipants ?? 0) / exercises.length * 10) / 10
    : 0;

  return (
    <div ref={pageRef} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-base sm:text-xl font-bold text-[#1e3a5f]">Auswertung</h1>
          {exercises.length > 0 && (
            <p className="text-xs sm:text-sm text-gray-500">
              {formatDateDE(from)} – {formatDateDE(to)} · {exercises.length} Übung{exercises.length !== 1 ? 'en' : ''}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0" data-no-export="true">
          {stats && exercises.length > 0 && (
            <>
              <button
                onClick={async () => {
                  try {
                    const token = localStorage.getItem('token');
                    const res = await fetch(`/api/v1/reports/adif?from=${from}&to=${to}`, {
                      headers: token ? { Authorization: `Bearer ${token}` } : {},
                    });
                    if (!res.ok) throw new Error();
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `BOS-ARSA_QSOs_${from}_${to}.adi`;
                    link.click();
                    URL.revokeObjectURL(url);
                  } catch {}
                }}
                className="bg-red-700 hover:bg-red-800 text-white px-2 sm:px-3 py-1.5 rounded text-xs sm:text-sm"
                title="ADIF-Datei für QRZ.com, LOTW etc."
              >
                Download ADIF
              </button>
              <button
                onClick={downloadFullPage}
                disabled={exporting}
                className="bg-[#1e3a5f] hover:bg-[#2a4a7f] text-white px-2 sm:px-3 py-1.5 rounded text-xs sm:text-sm disabled:opacity-50"
              >
                {exporting ? '...' : 'Download Auswertung'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Date range selector */}
      <div className="bg-white rounded-xl shadow p-3 sm:p-4" data-no-export="true">
        <div className="flex flex-wrap gap-2 mb-3">
          {[1, 2, 3, 4].map((q) => (
            <button
              key={q}
              onClick={() => applyQuarter(q)}
              className="bg-gray-100 hover:bg-blue-100 text-gray-700 hover:text-[#1e3a5f] px-3 py-1.5 rounded text-sm font-medium"
            >
              Q{q}
            </button>
          ))}
          <button
            onClick={applyYear}
            className="bg-gray-100 hover:bg-blue-100 text-gray-700 hover:text-[#1e3a5f] px-3 py-1.5 rounded text-sm font-medium"
          >
            Jahr {year}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label className="text-gray-500 text-xs">Von</label>
          <input
            type="date"
            value={from}
            onChange={(e) => handleFromChange(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          />
          <label className="text-gray-500 text-xs">Bis</label>
          <input
            type="date"
            value={to}
            onChange={(e) => handleToChange(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-gray-100">
          <span className="text-xs text-gray-500">Übungstyp:</span>
          {EXERCISE_TYPES.map(t => (
            <label key={t.value} className="flex items-center gap-1.5 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={selectedTypes.has(t.value)}
                onChange={() => toggleType(t.value)}
                className="w-3.5 h-3.5 accent-red-600"
              />
              <span className={selectedTypes.has(t.value) ? 'text-[#1e3a5f] font-medium' : 'text-gray-600'}>{t.short}</span>
            </label>
          ))}
          {selectedTypes.size > 0 && (
            <button
              onClick={() => { setSelectedTypes(new Set()); fetchStats(from, to, new Set()); }}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Alle anzeigen
            </button>
          )}
        </div>
      </div>

      {loading && <p className="text-gray-500">Laden...</p>}

      {!loading && exercises.length === 0 && (
        <div className="bg-white rounded-xl shadow p-6 text-center text-gray-500">
          Keine Übungen im gewählten Zeitraum gefunden.
        </div>
      )}

      {!loading && stats && exercises.length > 0 && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
            <div className="bg-white rounded-lg shadow-sm p-2 sm:p-4 text-center">
              <div className="text-2xl sm:text-3xl font-bold text-[#1e3a5f]">{stats.totalParticipants}</div>
              <div className="text-xs sm:text-sm text-gray-500">Teilnehmer (gesamt)</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-2 sm:p-4 text-center">
              <div className="text-2xl sm:text-3xl font-bold text-[#1e3a5f]">{stats.totalReports}</div>
              <div className="text-xs sm:text-sm text-gray-500">Rapporte</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-2 sm:p-4 text-center">
              <div className="text-2xl sm:text-3xl font-bold text-[#1e3a5f]">{exercises.length}</div>
              <div className="text-xs sm:text-sm text-gray-500">Übungen</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-2 sm:p-4 text-center">
              <div className="text-2xl sm:text-3xl font-bold text-gray-700">{avgParticipants}</div>
              <div className="text-xs sm:text-sm text-gray-500">Ø Teilnehmer/Übung</div>
            </div>
          </div>

          {/* Per-repeater summary */}
          {stats.perRepeater.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {stats.perRepeater.map((r) => (
                <div key={r.short_name} className="bg-white rounded-lg shadow-sm p-2 sm:p-3 text-center">
                  <div className="text-lg sm:text-xl font-bold text-gray-700">{r.count}</div>
                  <div className="text-xs text-gray-500 truncate">{r.short_name}</div>
                </div>
              ))}
            </div>
          )}

          {/* Collapsible exercise list */}
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <div
              onClick={() => setShowExercises((v) => !v)}
              className="bg-[#1e3a5f] text-white px-4 py-2 text-sm font-semibold cursor-pointer hover:bg-[#2a4a7f] flex items-center justify-between"
            >
              <span>Übungen ({exercises.length})</span>
              <span className="text-xs">{showExercises ? '\u25BC' : '\u25B6'}</span>
            </div>
            {showExercises && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm min-w-[360px]">
                  <thead>
                    <tr className="bg-gray-50 border-b text-left text-xs text-gray-500 uppercase">
                      <th className="px-2 sm:px-4 py-2">Datum</th>
                      <th className="px-2 sm:px-4 py-2 hidden sm:table-cell">Typ</th>
                      <th className="px-2 sm:px-4 py-2">Name</th>
                      <th className="px-2 sm:px-4 py-2 text-right w-20">Teiln.</th>
                      <th className="px-2 sm:px-4 py-2 text-right w-20">Rapp.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {exercises.map((ex) => (
                      <tr key={ex.id} className="hover:bg-blue-50">
                        <td className="px-2 sm:px-4 py-1.5 font-mono text-xs">{formatDateDE(ex.date)}</td>
                        <td className="px-2 sm:px-4 py-1.5 text-xs text-gray-500 hidden sm:table-cell">{getShortLabel(ex.exercise_type || '')}</td>
                        <td className="px-2 sm:px-4 py-1.5">{ex.name}</td>
                        <td className="px-2 sm:px-4 py-1.5 text-right">{ex.participant_count}</td>
                        <td className="px-2 sm:px-4 py-1.5 text-right">{ex.report_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Austria Map */}
          {stats.blStats.length > 0 && (
            <div ref={mapCardRef} className="bg-white rounded-xl shadow p-3 sm:p-4">
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <h2 className="text-xs sm:text-sm font-semibold text-[#1e3a5f]">
                  Teilnehmer nach Bundesland / Land
                </h2>
                <button
                  onClick={() => downloadChart(mapCardRef, `BOS-ARSA_Karte_${from}_${to}.png`)}
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
            const chartData = stats.bezirkStats.length > 0
              ? stats.bezirkStats.map(bz => ({ label: `${bz.bundesland} ${bz.bezirk_code}`, participants: bz.participants, reports: bz.reports }))
              : stats.blStats.map(bl => ({ label: bl.bundesland, participants: bl.participants, reports: bl.reports }));

            return chartData.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Bar chart */}
                <div ref={barCardRef} className="bg-white rounded-xl shadow p-3 sm:p-4">
                  <div className="flex items-center justify-between mb-2 sm:mb-3">
                    <h2 className="text-xs sm:text-sm font-semibold text-[#1e3a5f]">
                      Auswertung {formatDateDE(from)} – {formatDateDE(to)}
                    </h2>
                    <button
                      onClick={() => downloadChart(barCardRef, `BOS-ARSA_Stationen_${from}_${to}.png`)}
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

                {/* Pie chart */}
                <div ref={pieCardRef} className="bg-white rounded-xl shadow p-3 sm:p-4">
                  <div className="flex items-center justify-between mb-2 sm:mb-3">
                    <h2 className="text-xs sm:text-sm font-semibold text-[#1e3a5f]">
                      Rapporte Verteilung nach Bundesland / Land
                    </h2>
                    <button
                      onClick={() => downloadChart(pieCardRef, `BOS-ARSA_Verteilung_${from}_${to}.png`)}
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
                          backgroundColor: PIE_COLORS,
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
                        <tr key={`bl-${blCode}`} className="bg-gray-50 font-medium border-t">
                          <td className="px-4 py-1.5">{bl.name}</td>
                          <td className="px-4 py-1.5 text-right font-bold">{bl.totalParticipants}</td>
                          <td className="px-4 py-1.5 text-right font-bold">{bl.totalReports}</td>
                        </tr>
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
              <span className="text-xs">{showParticipants ? '\u25BC' : '\u25B6'}</span>
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
                        <td className="px-2 sm:px-4 py-1 font-mono font-medium">{p.callsign}</td>
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

          {/* Export section */}
          <div className="bg-white rounded-xl shadow p-4" data-no-export="true">
            <h2 className="text-sm font-semibold text-[#1e3a5f] mb-3">Export</h2>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={downloadFullPage}
                disabled={exporting}
                className="bg-[#1e3a5f] hover:bg-[#2a4a7f] text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
              >
                {exporting ? 'Exportieren...' : 'Download Auswertung'}
              </button>
              <button
                onClick={async () => {
                  try {
                    const token = localStorage.getItem('token');
                    const res = await fetch(`/api/v1/reports/adif?from=${from}&to=${to}`, {
                      headers: token ? { Authorization: `Bearer ${token}` } : {},
                    });
                    if (!res.ok) throw new Error();
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `BOS-ARSA_QSOs_${from}_${to}.adi`;
                    link.click();
                    URL.revokeObjectURL(url);
                  } catch {}
                }}
                className="bg-red-700 hover:bg-red-800 text-white px-4 py-2 rounded text-sm font-medium"
              >
                Download ADIF
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              ADIF-Datei kann in QRZ.com, LOTW oder andere Logbuch-Software importiert werden.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
