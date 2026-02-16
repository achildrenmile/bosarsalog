import { useState, useEffect, type FormEvent } from 'react';
import { apiFetch, getOrCreateOperator } from '../services/api';
import CallsignInput from './CallsignInput';

const BUNDESLAND_NAMES: Record<string, string> = {
  '01': 'OE1 Wien',
  '02': 'OE2 Salzburg',
  '03': 'OE3 Niederösterreich',
  '04': 'OE4 Burgenland',
  '05': 'OE5 Oberösterreich',
  '06': 'OE6 Steiermark',
  '07': 'OE7 Tirol',
  '08': 'OE8 Kärnten',
  '09': 'OE9 Vorarlberg',
  '10': 'Slowenien',
};

interface Props {
  exerciseId: string;
  repeaters: any[];
  reports: any[];
  onReportCreated: (report: any) => void;
  onReportUpdated: (report: any) => void;
  onReportDeleted: (reportId: number) => void;
}

export default function LandMode({ exerciseId, repeaters, reports, onReportCreated, onReportUpdated, onReportDeleted }: Props) {
  const [activeRepeaterId, setActiveRepeaterId] = useState<number | null>(null);

  // Entry form state
  const [callsign, setCallsign] = useState('');
  const [selectedOperator, setSelectedOperator] = useState<any>(null);
  const [rapport, setRapport] = useState('');
  const [notes, setNotes] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);

  useEffect(() => {
    if (repeaters.length > 0 && !activeRepeaterId) {
      setActiveRepeaterId(repeaters[0].repeater_id);
    }
  }, [repeaters, activeRepeaterId]);

  const activeRepeater = repeaters.find(r => r.repeater_id === activeRepeaterId);
  const repeaterReports = reports.filter(r => r.repeater_id === activeRepeaterId);

  // Group repeaters by Bundesland
  const repeatersByBl: Record<string, any[]> = {};
  const simplexRepeaters: any[] = [];
  const linkedRepeaters: any[] = [];
  for (const r of repeaters) {
    if (r.type === 'simplex') {
      simplexRepeaters.push(r);
    } else {
      const blCode = r.bundesland_code || '_other';
      if (!repeatersByBl[blCode]) repeatersByBl[blCode] = [];
      repeatersByBl[blCode].push(r);
      if (r.is_linked) linkedRepeaters.push(r);
    }
  }

  const sortedBlCodes = Object.keys(repeatersByBl).sort((a, b) => {
    if (a === '_other') return 1;
    if (b === '_other') return -1;
    return a.localeCompare(b);
  });

  const parseRapport = (raw: string) => {
    const match = raw.match(/^(\d)\/(\d)(.*)$/);
    if (!match) return { readability: null, strength: null, db_over_s9: null };
    return {
      readability: parseInt(match[1]),
      strength: parseInt(match[2]),
      db_over_s9: match[3]?.trim() || null,
    };
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeRepeaterId) return;
    const operator = await getOrCreateOperator(callsign, selectedOperator);
    if (!operator) return;
    setSelectedOperator(operator);

    const parsed = parseRapport(rapport);

    if (editingId) {
      try {
        const updated = await apiFetch(`/api/v1/exercises/${exerciseId}/reports/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify({ ...parsed, notes: notes || null }),
        });
        onReportUpdated(updated);
        setEditingId(null);
      } catch {}
    } else {
      try {
        const report = await apiFetch(`/api/v1/exercises/${exerciseId}/reports`, {
          method: 'POST',
          body: JSON.stringify({
            operator_id: operator.id,
            repeater_id: activeRepeaterId,
            ...parsed,
            notes: notes || null,
          }),
        });
        onReportCreated(report);

        // Cross-repeater sync: create placeholder entries on other repeaters
        for (const rep of repeaters) {
          if (rep.repeater_id !== activeRepeaterId) {
            const exists = reports.some(r => r.operator_id === operator.id && r.repeater_id === rep.repeater_id);
            if (!exists) {
              try {
                const placeholder = await apiFetch(`/api/v1/exercises/${exerciseId}/reports`, {
                  method: 'POST',
                  body: JSON.stringify({
                    operator_id: operator.id,
                    repeater_id: rep.repeater_id,
                  }),
                });
                onReportCreated(placeholder);
              } catch {}
            }
          }
        }
      } catch (err: any) {
        if (err.message?.includes('existiert')) {
          const existing = reports.find(r => r.operator_id === operator.id && r.repeater_id === activeRepeaterId);
          if (existing) {
            const updated = await apiFetch(`/api/v1/exercises/${exerciseId}/reports/${existing.id}`, {
              method: 'PATCH',
              body: JSON.stringify({ ...parsed, notes: notes || null }),
            });
            onReportUpdated(updated);
          }
        }
      }
    }

    setCallsign('');
    setSelectedOperator(null);
    setRapport('');
    setNotes('');
  };

  const handleEdit = (report: any) => {
    setEditingId(report.id);
    setCallsign(report.callsign);
    setSelectedOperator({ id: report.operator_id, callsign: report.callsign });
    const rapportStr = report.readability && report.strength
      ? `${report.readability}/${report.strength}${report.db_over_s9 || ''}`
      : '';
    setRapport(rapportStr);
    setNotes(report.notes || '');
  };

  const handleDelete = async (reportId: number) => {
    if (!confirm('Rapport löschen?')) return;
    try {
      await apiFetch(`/api/v1/exercises/${exerciseId}/reports/${reportId}`, { method: 'DELETE' });
      onReportDeleted(reportId);
    } catch {}
  };

  return (
    <div className="space-y-3">
      {/* Repeater tabs grouped by Bundesland */}
      <div className="space-y-1">
        {sortedBlCodes.map(blCode => {
          const blReps = repeatersByBl[blCode];
          const label = BUNDESLAND_NAMES[blCode] || 'Sonstige';
          return (
            <div key={blCode}>
              <div className="px-1 mb-0.5">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
              </div>
              <div className="flex flex-wrap gap-1 mb-1">
                {blReps.map(r => {
                  const repReportCount = reports.filter(rp => rp.repeater_id === r.repeater_id && !rp.is_op_marker && rp.readability).length;
                  return (
                    <button
                      key={r.repeater_id}
                      onClick={() => setActiveRepeaterId(r.repeater_id)}
                      className={`px-3 py-1.5 rounded text-sm flex items-center gap-1 ${r.repeater_id === activeRepeaterId ? 'bg-[#1e3a5f] text-white font-medium' : 'bg-white text-gray-700 hover:bg-gray-100 border'}`}
                    >
                      {r.short_name}
                      {r.operator_callsign && (
                        <span className={`text-xs px-1 py-0.5 rounded ${r.repeater_id === activeRepeaterId ? 'bg-white/20' : 'bg-blue-100 text-blue-800'}`}>
                          {r.operator_callsign}
                        </span>
                      )}
                      {repReportCount > 0 && (
                        <span className={`text-xs rounded-full px-1.5 ${r.repeater_id === activeRepeaterId ? 'bg-white/20' : 'bg-gray-200'}`}>
                          {repReportCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {simplexRepeaters.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1 mb-0.5">Simplex</div>
            <div className="flex flex-wrap gap-1 mb-1">
              {simplexRepeaters.map(r => {
                const repReportCount = reports.filter(rp => rp.repeater_id === r.repeater_id && !rp.is_op_marker && rp.readability).length;
                return (
                  <button
                    key={r.repeater_id}
                    onClick={() => setActiveRepeaterId(r.repeater_id)}
                    className={`px-3 py-1.5 rounded text-sm flex items-center gap-1 ${r.repeater_id === activeRepeaterId ? 'bg-[#1e3a5f] text-white font-medium' : 'bg-white text-gray-700 hover:bg-gray-100 border'}`}
                  >
                    {r.short_name}
                    {r.operator_callsign && (
                      <span className={`text-xs px-1 py-0.5 rounded ${r.repeater_id === activeRepeaterId ? 'bg-white/20' : 'bg-blue-100 text-blue-800'}`}>
                        {r.operator_callsign}
                      </span>
                    )}
                    {repReportCount > 0 && (
                      <span className={`text-xs rounded-full px-1.5 ${r.repeater_id === activeRepeaterId ? 'bg-white/20' : 'bg-gray-200'}`}>
                        {repReportCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {linkedRepeaters.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1 mb-0.5">OE-Link</div>
            <div className="flex flex-wrap gap-1 mb-1">
              {linkedRepeaters.map(r => {
                const repReportCount = reports.filter(rp => rp.repeater_id === r.repeater_id && !rp.is_op_marker && rp.readability).length;
                return (
                  <button
                    key={`oelink-${r.repeater_id}`}
                    onClick={() => setActiveRepeaterId(r.repeater_id)}
                    className={`px-3 py-1.5 rounded text-sm flex items-center gap-1 ${r.repeater_id === activeRepeaterId ? 'bg-blue-700 text-white font-medium' : 'bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200'}`}
                  >
                    {r.short_name}
                    {r.operator_callsign && (
                      <span className={`text-xs px-1 py-0.5 rounded ${r.repeater_id === activeRepeaterId ? 'bg-white/20' : 'bg-blue-100 text-blue-700'}`}>
                        {r.operator_callsign}
                      </span>
                    )}
                    {repReportCount > 0 && (
                      <span className={`text-xs rounded-full px-1.5 ${r.repeater_id === activeRepeaterId ? 'bg-white/20' : 'bg-blue-200'}`}>
                        {repReportCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Repeater info */}
      {activeRepeater && (
        <div className="text-xs text-gray-500 flex gap-4">
          {activeRepeater.frequency_mhz && <span>{activeRepeater.frequency_mhz} MHz</span>}
          {activeRepeater.offset_mhz && <span>Offset: {activeRepeater.offset_mhz > 0 ? '+' : ''}{activeRepeater.offset_mhz} MHz</span>}
          {activeRepeater.ctcss_hz && <span>CTCSS: {activeRepeater.ctcss_hz} Hz</span>}
          {activeRepeater.burst_hz && <span>Burst: {activeRepeater.burst_hz} Hz</span>}
          {activeRepeater.repeater_callsign && <span className="font-mono">{activeRepeater.repeater_callsign}</span>}
        </div>
      )}

      {/* Entry form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm p-3 flex items-center gap-2 flex-wrap">
        <CallsignInput
          value={callsign}
          onChange={setCallsign}
          onSelect={setSelectedOperator}
          autoFocus
          className="w-36"
        />
        <input
          type="text"
          value={rapport}
          onChange={e => setRapport(e.target.value.toUpperCase())}
          placeholder="5/9+20"
          className="border border-gray-300 rounded px-2 py-1 font-mono text-sm w-24 focus:outline-none focus:ring-2 focus:ring-blue-500"
          onKeyDown={e => {
            if (e.altKey && e.key >= '1' && e.key <= '9') {
              e.preventDefault();
              setRapport(`5/${e.key}`);
            }
          }}
        />
        <input
          type="text"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Sonstiges"
          className="border border-gray-300 rounded px-2 py-1 text-sm flex-1 min-w-[100px] focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button type="submit" className="bg-[#c8102e] hover:bg-[#a00d24] text-white px-4 py-1 rounded text-sm font-medium">
          {editingId ? 'Speichern' : 'Eintragen'}
        </button>
        {editingId && (
          <button type="button" onClick={() => { setEditingId(null); setCallsign(''); setSelectedOperator(null); setRapport(''); setNotes(''); }} className="text-gray-500 text-sm hover:text-gray-700">
            Abbrechen
          </button>
        )}
      </form>

      {/* Reports per Umsetzer */}
      <div className="space-y-2">
        {repeaters.map(rep => {
          const repReports = reports.filter(r => r.repeater_id === rep.repeater_id && !r.is_op_marker);
          const reportCount = repReports.filter(r => r.readability).length;
          const isActive = rep.repeater_id === activeRepeaterId;

          return (
            <div key={rep.repeater_id} className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div
                onClick={() => setActiveRepeaterId(rep.repeater_id)}
                className={`px-3 py-1.5 flex items-center gap-2 border-b cursor-pointer ${isActive ? 'bg-[#1e3a5f] text-white' : 'bg-gray-50 hover:bg-gray-100'}`}
              >
                <span className={`font-medium text-sm ${isActive ? '' : 'text-gray-800'}`}>{rep.short_name}</span>
                {rep.operator_callsign && (
                  <span className={`text-xs px-1 py-0.5 rounded ${isActive ? 'bg-white/20' : 'bg-blue-100 text-blue-800'}`}>
                    {rep.operator_callsign}
                  </span>
                )}
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20' : 'bg-[#0d6efd] text-white'}`}>{reportCount}</span>
                {rep.frequency_mhz && (
                  <span className={`text-xs ${isActive ? 'text-white/70' : 'text-gray-400'}`}>{rep.frequency_mhz} MHz</span>
                )}
              </div>
              {repReports.length > 0 && (
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-gray-100">
                    {repReports.map((r, idx) => (
                      <tr
                        key={r.id}
                        onClick={() => { setActiveRepeaterId(rep.repeater_id); handleEdit(r); }}
                        className="hover:bg-blue-50 cursor-pointer"
                      >
                        <td className="px-3 py-1 text-xs text-gray-400 w-8">{idx + 1}</td>
                        <td className="px-3 py-1">
                          <span className="font-mono font-medium text-xs">{r.callsign}</span>
                          {r.bezirk_code && (
                            <span className="ml-1 text-xs bg-gray-200 rounded px-1">{r.bezirk_code}</span>
                          )}
                        </td>
                        <td className="px-3 py-1 font-mono text-xs w-24">
                          {r.readability && r.strength
                            ? `${r.readability}/${r.strength}${r.db_over_s9 || ''}`
                            : <span className="text-gray-300">—</span>
                          }
                        </td>
                        <td className="px-3 py-1 text-xs text-gray-600">{r.notes || ''}</td>
                        <td className="px-3 py-1 w-8">
                          <button
                            onClick={e => { e.stopPropagation(); handleDelete(r.id); }}
                            className="text-red-400 hover:text-red-600 text-xs"
                          >
                            x
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
