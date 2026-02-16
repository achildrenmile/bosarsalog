import { useState, useEffect, useRef, type FormEvent } from 'react';
import { apiFetch, getOrCreateOperator } from '../services/api';
import CallsignInput, { type CallsignInputRef } from './CallsignInput';

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

interface EntryForm {
  callsign: string;
  operator: any;
  rapport: string;
  notes: string;
}

export default function LandMode({ exerciseId, repeaters, reports, onReportCreated, onReportUpdated, onReportDeleted }: Props) {
  const [collapsedReps, setCollapsedReps] = useState<Set<number>>(new Set());
  const [opCallsigns, setOpCallsigns] = useState<Record<number, string>>({});
  const [bezirke, setBezirke] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<EntryForm>({ callsign: '', operator: null, rapport: '', notes: '' });

  // Load bezirke + OP callsigns
  useEffect(() => {
    Promise.all([
      apiFetch('/api/v1/reference/bezirke'),
      apiFetch(`/api/v1/exercises/${exerciseId}/repeaters`),
    ]).then(([bz, exReps]) => {
      setBezirke(bz);
      const ops: Record<number, string> = {};
      for (const er of exReps) {
        if (er.operator_callsign) {
          ops[er.repeater_id] = er.operator_callsign;
        }
      }
      setOpCallsigns(ops);
    }).catch(() => {});
  }, [exerciseId]);

  // Group repeaters by Bundesland — exclude linked repeaters (those belong to BundMode)
  const repeatersByBl: Record<string, any[]> = {};
  const simplexRepeaters: any[] = [];
  for (const r of repeaters) {
    if (r.is_linked) continue;
    if (r.type === 'simplex') {
      simplexRepeaters.push(r);
    } else {
      const blCode = r.bundesland_code || '_other';
      if (!repeatersByBl[blCode]) repeatersByBl[blCode] = [];
      repeatersByBl[blCode].push(r);
    }
  }

  const sortedBlCodes = Object.keys(repeatersByBl).sort((a, b) => {
    if (a === '_other') return 1;
    if (b === '_other') return -1;
    return a.localeCompare(b);
  });

  const toggleRepeater = (repId: number) => {
    setCollapsedReps(prev => {
      const next = new Set(prev);
      if (next.has(repId)) next.delete(repId); else next.add(repId);
      return next;
    });
  };

  const saveOpCallsign = async (repeaterId: number, val: string) => {
    try {
      await apiFetch(`/api/v1/exercises/${exerciseId}/repeaters`, {
        method: 'POST',
        body: JSON.stringify({ repeater_id: repeaterId, operator_callsign: val || null }),
      });
    } catch {
      await apiFetch(`/api/v1/exercises/${exerciseId}/repeaters/${repeaterId}`, {
        method: 'PATCH',
        body: JSON.stringify({ operator_callsign: val || null }),
      });
    }
  };

  const parseRapport = (raw: string) => {
    const match = raw.match(/^(\d)\/(\d)(.*)$/);
    if (!match) return { readability: null, strength: null, db_over_s9: null };
    return {
      readability: parseInt(match[1]),
      strength: parseInt(match[2]),
      db_over_s9: match[3]?.trim() || null,
    };
  };

  const handleBezirkSubmit = async (bezirkCode: string, repeaterId: number, form: EntryForm) => {
    try {
      const operator = await getOrCreateOperator(form.callsign, form.operator);
      if (!operator) return;

      // Set operator's bezirk_code to match the row they were entered in
      if (bezirkCode && bezirkCode !== '??') {
        apiFetch(`/api/v1/operators/${operator.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ bezirk_code: bezirkCode }),
        }).catch(() => {});
      }

      const parsed = parseRapport(form.rapport);

      try {
        const report = await apiFetch(`/api/v1/exercises/${exerciseId}/reports`, {
          method: 'POST',
          body: JSON.stringify({
            operator_id: operator.id,
            repeater_id: repeaterId,
            ...parsed,
            notes: form.notes || null,
          }),
        });
        // Force bezirk_code on report so it shows in the correct row immediately
        if (bezirkCode && bezirkCode !== '??') report.bezirk_code = bezirkCode;
        onReportCreated(report);
      } catch (err: any) {
        if (err.message?.includes('existiert')) {
          const existing = reports.find(r => r.operator_id === operator.id && r.repeater_id === repeaterId);
          if (existing) {
            const updated = await apiFetch(`/api/v1/exercises/${exerciseId}/reports/${existing.id}`, {
              method: 'PATCH',
              body: JSON.stringify({ ...parsed, notes: form.notes || null }),
            });
            if (bezirkCode && bezirkCode !== '??') updated.bezirk_code = bezirkCode;
            onReportUpdated(updated);
          }
        }
      }
    } catch {}
  };

  const handleEdit = (report: any) => {
    setEditingId(report.id);
    setEditForm({
      callsign: report.callsign,
      operator: { id: report.operator_id, callsign: report.callsign },
      rapport: report.readability && report.strength ? `${report.readability}/${report.strength}${report.db_over_s9 || ''}` : '',
      notes: report.notes || '',
    });
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    const parsed = parseRapport(editForm.rapport);
    try {
      const updated = await apiFetch(`/api/v1/exercises/${exerciseId}/reports/${editingId}`, {
        method: 'PATCH',
        body: JSON.stringify({ ...parsed, notes: editForm.notes || null }),
      });
      onReportUpdated(updated);
      setEditingId(null);
    } catch {}
  };

  const handleDelete = async (reportId: number) => {
    if (!confirm('Rapport löschen?')) return;
    try {
      await apiFetch(`/api/v1/exercises/${exerciseId}/reports/${reportId}`, { method: 'DELETE' });
      onReportDeleted(reportId);
    } catch {}
  };

  const renderRepeaterCard = (rep: any) => {
    const repReports = reports.filter(r => r.repeater_id === rep.repeater_id && !r.is_op_marker);
    const reportCount = repReports.filter(r => r.readability).length;
    const isCollapsed = collapsedReps.has(rep.repeater_id);
    const repBezirke = bezirke.filter(b => b.bundesland_code === rep.bundesland_code);

    return (
      <div key={rep.repeater_id} className="bg-white rounded-lg shadow-sm">
        <div className="bg-gray-50 px-2 sm:px-3 py-2 flex flex-wrap items-center justify-between border-b gap-1">
          <div
            onClick={() => toggleRepeater(rep.repeater_id)}
            className="flex items-center gap-1.5 sm:gap-2 cursor-pointer hover:bg-gray-100 rounded px-1 -mx-1 min-w-0"
          >
            <span className="text-xs text-gray-400">{isCollapsed ? '▶' : '▼'}</span>
            <span className="font-medium text-xs sm:text-sm truncate">{rep.short_name}</span>
            <span className="bg-[#0d6efd] text-white text-xs px-1.5 py-0.5 rounded-full flex-shrink-0">{reportCount}</span>
            {rep.frequency_mhz && (
              <span className="text-xs text-gray-400 hidden sm:inline">{rep.frequency_mhz} MHz</span>
            )}
            {rep.offset_mhz && (
              <span className="text-xs text-gray-400 hidden md:inline">({rep.offset_mhz > 0 ? '+' : ''}{rep.offset_mhz})</span>
            )}
            {rep.ctcss_hz && (
              <span className="text-xs text-gray-400 hidden md:inline">CTCSS {rep.ctcss_hz}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
            <label className="text-xs text-gray-500">OP:</label>
            <input
              type="text"
              value={opCallsigns[rep.repeater_id] || ''}
              onChange={e => setOpCallsigns(prev => ({ ...prev, [rep.repeater_id]: e.target.value.toUpperCase() }))}
              onBlur={e => saveOpCallsign(rep.repeater_id, e.target.value.toUpperCase())}
              placeholder="Rufz."
              className="border border-gray-300 rounded px-1.5 py-0.5 text-xs font-mono uppercase w-20 sm:w-24 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {!isCollapsed && (
          <div className="divide-y divide-gray-100">
            {repBezirke.length > 0 ? (
              <>
                {repBezirke.map(bz => {
                  const bzReports = repReports.filter(r => r.bezirk_code === bz.code);
                  return (
                    <BezirkRow
                      key={bz.code}
                      bezirk={bz}
                      reports={bzReports}
                      repeaterId={rep.repeater_id}
                      onSubmit={(form) => handleBezirkSubmit(bz.code, rep.repeater_id, form)}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      editingId={editingId}
                      editForm={editForm}
                      onEditChange={setEditForm}
                      onEditSave={handleUpdate}
                      onEditCancel={() => setEditingId(null)}
                    />
                  );
                })}
                {/* Reports without matching bezirk */}
                {(() => {
                  const bzCodes = new Set(repBezirke.map(b => b.code));
                  const unassigned = repReports.filter(r => !r.bezirk_code || !bzCodes.has(r.bezirk_code));
                  if (unassigned.length === 0) return null;
                  return (
                    <div className="px-3 py-1.5">
                      <table className="w-full text-xs mb-1">
                        <tbody>
                          {unassigned.map((r, idx) => (
                            <tr key={r.id} className="hover:bg-blue-50 group">
                              {editingId === r.id ? (
                                <td colSpan={5} className="py-0.5">
                                  <div className="flex items-center gap-1 bg-blue-50 rounded p-1">
                                    <span className="font-mono font-medium">{r.callsign}</span>
                                    <input value={editForm.rapport} onChange={e => setEditForm({ ...editForm, rapport: e.target.value.toUpperCase() })} className="border rounded px-1 py-0.5 font-mono text-xs w-20" autoFocus />
                                    <input value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} placeholder="Sonst." className="border rounded px-1 py-0.5 text-xs w-20" />
                                    <button onClick={handleUpdate} className="text-green-600 text-xs font-bold">OK</button>
                                    <button onClick={() => setEditingId(null)} className="text-gray-400 text-xs">X</button>
                                  </div>
                                </td>
                              ) : (
                                <>
                                  <td className="py-0.5 text-gray-400 w-4">{idx + 1}</td>
                                  <td className="py-0.5 font-mono font-medium cursor-pointer" onClick={() => handleEdit(r)}>{r.callsign}</td>
                                  <td className="py-0.5 font-mono text-gray-500 w-24 cursor-pointer" onClick={() => handleEdit(r)}>
                                    {r.readability && r.strength ? `${r.readability}/${r.strength}${r.db_over_s9 || ''}` : '—'}
                                  </td>
                                  <td className="py-0.5 text-gray-500 cursor-pointer" onClick={() => handleEdit(r)}>{r.notes || ''}</td>
                                  <td className="py-0.5 w-4">
                                    <button onClick={() => handleDelete(r.id)} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100">x</button>
                                  </td>
                                </>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </>
            ) : (
              /* No Bezirke — flat list with input form */
              <FlatReportRow
                reports={repReports}
                repeaterId={rep.repeater_id}
                onSubmit={(form) => handleBezirkSubmit('', rep.repeater_id, form)}
                onEdit={handleEdit}
                onDelete={handleDelete}
                editingId={editingId}
                editForm={editForm}
                onEditChange={setEditForm}
                onEditSave={handleUpdate}
                onEditCancel={() => setEditingId(null)}
              />
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-2">
      {sortedBlCodes.map(blCode => {
        const blReps = repeatersByBl[blCode];
        const label = BUNDESLAND_NAMES[blCode] || 'Sonstige';
        return (
          <div key={blCode}>
            <div className="px-1 mb-1 mt-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
            </div>
            <div className="space-y-2">
              {blReps.map(rep => renderRepeaterCard(rep))}
            </div>
          </div>
        );
      })}

      {simplexRepeaters.length > 0 && (
        <div>
          <div className="px-1 mb-1 mt-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Simplex</span>
          </div>
          <div className="space-y-2">
            {simplexRepeaters.map(rep => renderRepeaterCard(rep))}
          </div>
        </div>
      )}
    </div>
  );
}

interface BezirkRowProps {
  bezirk: any;
  reports: any[];
  repeaterId: number;
  onSubmit: (form: EntryForm) => void;
  onEdit: (report: any) => void;
  onDelete: (id: number) => void;
  editingId: number | null;
  editForm: EntryForm;
  onEditChange: (form: EntryForm) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
}

function BezirkRow({ bezirk, reports, repeaterId, onSubmit, onEdit, onDelete, editingId, editForm, onEditChange, onEditSave, onEditCancel }: BezirkRowProps) {
  const [form, setForm] = useState<EntryForm>({ callsign: '', operator: null, rapport: '5/9', notes: '' });
  const callsignRef = useRef<CallsignInputRef>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.callsign && !form.operator) return;
    onSubmit(form);
    setForm({ callsign: '', operator: null, rapport: '5/9', notes: '' });
    setTimeout(() => callsignRef.current?.focus(), 50);
  };

  return (
    <div className="px-2 sm:px-3 py-1.5">
      {bezirk.code !== '??' && (
        <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
          <span className={`text-xs font-mono px-1.5 py-0.5 rounded text-white ${bezirk.is_capital ? 'bg-[#dc3545]' : 'bg-[#6c757d]'}`}>
            {bezirk.code}
          </span>
          <span className="text-xs text-gray-500 truncate">{bezirk.name}</span>
          {reports.length > 0 && <span className="text-xs text-gray-400 flex-shrink-0">({reports.length})</span>}
        </div>
      )}

      {reports.length > 0 && (
        <table className="w-full text-xs mb-1">
          <tbody>
            {reports.map((r, idx) => (
              <tr key={r.id} className="hover:bg-blue-50 group">
                {editingId === r.id ? (
                  <td colSpan={5} className="py-0.5">
                    <div className="flex items-center gap-1 bg-blue-50 rounded p-1 flex-wrap">
                      <span className="font-mono font-medium">{r.callsign}</span>
                      <input value={editForm.rapport} onChange={e => onEditChange({ ...editForm, rapport: e.target.value.toUpperCase() })} className="border rounded px-1 py-0.5 font-mono text-xs w-16 sm:w-20" autoFocus />
                      <input value={editForm.notes} onChange={e => onEditChange({ ...editForm, notes: e.target.value })} placeholder="Sonst." className="border rounded px-1 py-0.5 text-xs w-16 sm:w-20" />
                      <button onClick={onEditSave} className="text-green-600 text-xs font-bold">OK</button>
                      <button onClick={onEditCancel} className="text-gray-400 text-xs">X</button>
                    </div>
                  </td>
                ) : (
                  <>
                    <td className="py-0.5 text-gray-400 w-4">{idx + 1}</td>
                    <td className="py-0.5 font-mono font-medium cursor-pointer" onClick={() => onEdit(r)}>{r.callsign}</td>
                    <td className="py-0.5 font-mono text-gray-500 w-16 sm:w-24 cursor-pointer" onClick={() => onEdit(r)}>
                      {r.readability && r.strength ? `${r.readability}/${r.strength}${r.db_over_s9 || ''}` : '—'}
                    </td>
                    <td className="py-0.5 text-gray-500 cursor-pointer hidden sm:table-cell" onClick={() => onEdit(r)}>{r.notes || ''}</td>
                    <td className="py-0.5 w-4">
                      <button onClick={() => onDelete(r.id)} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100">x</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <form onSubmit={handleSubmit} className="flex items-center gap-1">
        <CallsignInput
          ref={callsignRef}
          value={form.callsign}
          onChange={v => setForm(f => ({ ...f, callsign: v }))}
          onSelect={op => setForm(f => ({ ...f, operator: op, callsign: op.callsign }))}
          className="w-24 sm:w-28"
        />
        <input
          type="text"
          value={form.rapport}
          onChange={e => setForm(f => ({ ...f, rapport: e.target.value.toUpperCase() }))}
          placeholder="5/9"
          className="border border-gray-300 rounded px-1.5 py-0.5 font-mono text-xs w-16 sm:w-20 focus:outline-none focus:ring-1 focus:ring-blue-500"
          onKeyDown={e => {
            if (e.altKey && e.key >= '1' && e.key <= '9') {
              e.preventDefault();
              setForm(f => ({ ...f, rapport: `5/${e.key}` }));
            }
          }}
        />
        <input
          type="text"
          value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          placeholder="Sonst."
          className="border border-gray-300 rounded px-1.5 py-0.5 text-xs flex-1 min-w-[40px] sm:min-w-[60px] focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button type="submit" className="bg-[#c8102e] hover:bg-[#a00d24] text-white px-2 py-0.5 rounded text-xs flex-shrink-0">
          +
        </button>
      </form>
    </div>
  );
}

interface FlatReportRowProps {
  reports: any[];
  repeaterId: number;
  onSubmit: (form: EntryForm) => void;
  onEdit: (report: any) => void;
  onDelete: (id: number) => void;
  editingId: number | null;
  editForm: EntryForm;
  onEditChange: (form: EntryForm) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
}

function FlatReportRow({ reports, repeaterId, onSubmit, onEdit, onDelete, editingId, editForm, onEditChange, onEditSave, onEditCancel }: FlatReportRowProps) {
  const [form, setForm] = useState<EntryForm>({ callsign: '', operator: null, rapport: '5/9', notes: '' });
  const callsignRef = useRef<CallsignInputRef>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.callsign && !form.operator) return;
    onSubmit(form);
    setForm({ callsign: '', operator: null, rapport: '5/9', notes: '' });
    setTimeout(() => callsignRef.current?.focus(), 50);
  };

  return (
    <div className="px-2 sm:px-3 py-1.5">
      {reports.length > 0 && (
        <table className="w-full text-xs mb-1">
          <tbody>
            {reports.map((r, idx) => (
              <tr key={r.id} className="hover:bg-blue-50 group">
                {editingId === r.id ? (
                  <td colSpan={5} className="py-0.5">
                    <div className="flex items-center gap-1 bg-blue-50 rounded p-1 flex-wrap">
                      <span className="font-mono font-medium">{r.callsign}</span>
                      <input value={editForm.rapport} onChange={e => onEditChange({ ...editForm, rapport: e.target.value.toUpperCase() })} className="border rounded px-1 py-0.5 font-mono text-xs w-16 sm:w-20" autoFocus />
                      <input value={editForm.notes} onChange={e => onEditChange({ ...editForm, notes: e.target.value })} placeholder="Sonst." className="border rounded px-1 py-0.5 text-xs w-16 sm:w-20" />
                      <button onClick={onEditSave} className="text-green-600 text-xs font-bold">OK</button>
                      <button onClick={onEditCancel} className="text-gray-400 text-xs">X</button>
                    </div>
                  </td>
                ) : (
                  <>
                    <td className="py-0.5 text-gray-400 w-4">{idx + 1}</td>
                    <td className="py-0.5 font-mono font-medium cursor-pointer" onClick={() => onEdit(r)}>{r.callsign}</td>
                    <td className="py-0.5 font-mono text-gray-500 w-16 sm:w-24 cursor-pointer" onClick={() => onEdit(r)}>
                      {r.readability && r.strength ? `${r.readability}/${r.strength}${r.db_over_s9 || ''}` : '—'}
                    </td>
                    <td className="py-0.5 text-gray-500 cursor-pointer hidden sm:table-cell" onClick={() => onEdit(r)}>{r.notes || ''}</td>
                    <td className="py-0.5 w-4">
                      <button onClick={() => onDelete(r.id)} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100">x</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <form onSubmit={handleSubmit} className="flex items-center gap-1">
        <CallsignInput
          ref={callsignRef}
          value={form.callsign}
          onChange={v => setForm(f => ({ ...f, callsign: v }))}
          onSelect={op => setForm(f => ({ ...f, operator: op, callsign: op.callsign }))}
          className="w-24 sm:w-28"
        />
        <input
          type="text"
          value={form.rapport}
          onChange={e => setForm(f => ({ ...f, rapport: e.target.value.toUpperCase() }))}
          placeholder="5/9"
          className="border border-gray-300 rounded px-1.5 py-0.5 font-mono text-xs w-16 sm:w-20 focus:outline-none focus:ring-1 focus:ring-blue-500"
          onKeyDown={e => {
            if (e.altKey && e.key >= '1' && e.key <= '9') {
              e.preventDefault();
              setForm(f => ({ ...f, rapport: `5/${e.key}` }));
            }
          }}
        />
        <input
          type="text"
          value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          placeholder="Sonst."
          className="border border-gray-300 rounded px-1.5 py-0.5 text-xs flex-1 min-w-[40px] sm:min-w-[60px] focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button type="submit" className="bg-[#c8102e] hover:bg-[#a00d24] text-white px-2 py-0.5 rounded text-xs flex-shrink-0">
          +
        </button>
      </form>
    </div>
  );
}
