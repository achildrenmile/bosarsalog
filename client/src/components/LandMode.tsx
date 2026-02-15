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
  const [allBezirke, setAllBezirke] = useState<any[]>([]);
  const [bundeslaender, setBundeslaender] = useState<any[]>([]);

  // Entry form state
  const [callsign, setCallsign] = useState('');
  const [selectedOperator, setSelectedOperator] = useState<any>(null);
  const [rapport, setRapport] = useState('');
  const [notes, setNotes] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);

  useEffect(() => {
    apiFetch('/api/v1/reference/bundeslaender').then(setBundeslaender).catch(() => {});
    apiFetch('/api/v1/reference/bezirke').then(setAllBezirke).catch(() => {});
  }, []);

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

  // Sort Bundesland codes
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

  // Group reports by Bezirk
  const reportsByBezirk: Record<string, any[]> = {};
  for (const r of repeaterReports) {
    const key = r.bezirk_code || '_other';
    if (!reportsByBezirk[key]) reportsByBezirk[key] = [];
    reportsByBezirk[key].push(r);
  }

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
                      className={`px-3 py-1.5 rounded text-sm flex items-center gap-1 ${r.repeater_id === activeRepeaterId ? 'bg-[#5b3a1a] text-white font-medium' : 'bg-white text-gray-700 hover:bg-gray-100 border'}`}
                    >
                      {r.short_name}
                      {r.operator_callsign && (
                        <span className={`text-xs px-1 py-0.5 rounded ${r.repeater_id === activeRepeaterId ? 'bg-white/20' : 'bg-amber-100 text-amber-800'}`}>
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

        {/* Simplex tabs */}
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
                    className={`px-3 py-1.5 rounded text-sm flex items-center gap-1 ${r.repeater_id === activeRepeaterId ? 'bg-[#5b3a1a] text-white font-medium' : 'bg-white text-gray-700 hover:bg-gray-100 border'}`}
                  >
                    {r.short_name}
                    {r.operator_callsign && (
                      <span className={`text-xs px-1 py-0.5 rounded ${r.repeater_id === activeRepeaterId ? 'bg-white/20' : 'bg-amber-100 text-amber-800'}`}>
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

        {/* OE-Link tabs */}
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
          className="border border-gray-300 rounded px-2 py-1 font-mono text-sm w-24 focus:outline-none focus:ring-2 focus:ring-amber-500"
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
          className="border border-gray-300 rounded px-2 py-1 text-sm flex-1 min-w-[100px] focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
        <button type="submit" className="bg-[#5b3a1a] hover:bg-[#7a5230] text-white px-4 py-1 rounded text-sm font-medium">
          {editingId ? 'Speichern' : 'Eintragen'}
        </button>
        {editingId && (
          <button type="button" onClick={() => { setEditingId(null); setCallsign(''); setSelectedOperator(null); setRapport(''); setNotes(''); }} className="text-gray-500 text-sm hover:text-gray-700">
            Abbrechen
          </button>
        )}
      </form>

      {/* Reports grouped by Bezirk */}
      <div className="space-y-2">
        {bundeslaender.filter(bl => !bl.is_international).map(bl => {
          const blBezirke = allBezirke.filter(b => b.bundesland_code === bl.code);
          const blReports = repeaterReports.filter(r => r.bundesland_code === bl.code);
          if (blReports.length === 0) return null;

          return (
            <div key={bl.code} className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="bg-gray-50 px-3 py-1.5 flex items-center gap-2 border-b">
                <span className="font-medium text-sm">{bl.name}</span>
                <span className="bg-[#0d6efd] text-white text-xs px-1.5 py-0.5 rounded-full">{blReports.filter(r => !r.is_op_marker && r.readability).length}</span>
              </div>
              <div className="divide-y divide-gray-100">
                {blBezirke.map(bz => {
                  const bzReports = blReports.filter(r => r.bezirk_code === bz.code);
                  if (bzReports.length === 0) return null;
                  return (
                    <div key={bz.code} className="px-3 py-1 flex flex-wrap items-center gap-2 text-sm">
                      <span className={`text-xs font-mono px-1.5 py-0.5 rounded text-white ${bz.is_capital ? 'bg-[#dc3545]' : 'bg-[#6c757d]'}`}>
                        {bz.code}
                      </span>
                      <div className="flex flex-wrap gap-2 flex-1">
                        {bzReports.map(r => (
                          <span
                            key={r.id}
                            onClick={() => handleEdit(r)}
                            className="cursor-pointer hover:bg-amber-50 px-1 rounded group"
                          >
                            <span className="font-mono text-xs">{r.callsign}</span>
                            {r.readability && r.strength && (
                              <span className="ml-1 text-gray-500 text-xs">
                                {r.readability}/{r.strength}{r.db_over_s9 || ''}
                              </span>
                            )}
                            {r.notes && <span className="ml-1 text-amber-600 text-xs">({r.notes})</span>}
                            <button
                              onClick={e => { e.stopPropagation(); handleDelete(r.id); }}
                              className="ml-1 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 text-xs"
                            >
                              x
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Uncategorized */}
        {reportsByBezirk['_other']?.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-3">
            <div className="text-sm font-medium mb-1">Sonstige</div>
            {reportsByBezirk['_other'].map(r => (
              <span key={r.id} onClick={() => handleEdit(r)} className="cursor-pointer hover:bg-amber-50 px-1 rounded text-sm">
                <span className="font-mono text-xs">{r.callsign}</span>
                {r.readability && r.strength && (
                  <span className="ml-1 text-gray-500 text-xs">{r.readability}/{r.strength}{r.db_over_s9 || ''}</span>
                )}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
