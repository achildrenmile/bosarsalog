import { useState, useEffect, useRef, type FormEvent } from 'react';
import { apiFetch, getOrCreateOperator } from '../services/api';
import CallsignInput, { type CallsignInputRef } from './CallsignInput';

interface Props {
  exerciseId: string;
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

export default function BundMode({ exerciseId, reports, onReportCreated, onReportUpdated, onReportDeleted }: Props) {
  const [bundeslaender, setBundeslaender] = useState<any[]>([]);
  const [bezirke, setBezirke] = useState<any[]>([]);
  const [linkedRepeaters, setLinkedRepeaters] = useState<any[]>([]);
  const [blRepSelection, setBlRepSelection] = useState<Record<string, number>>({});
  const [blOpCallsigns, setBlOpCallsigns] = useState<Record<string, string>>({});
  const [collapsedBl, setCollapsedBl] = useState<Set<string>>(new Set());
  const [addRepBl, setAddRepBl] = useState<string | null>(null);
  const [newRepName, setNewRepName] = useState('');
  const [newRepFreq, setNewRepFreq] = useState('');
  const [newRepCallsign, setNewRepCallsign] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<EntryForm>({ callsign: '', operator: null, rapport: '', notes: '' });

  useEffect(() => {
    Promise.all([
      apiFetch('/api/v1/reference/bundeslaender'),
      apiFetch('/api/v1/reference/bezirke'),
      apiFetch('/api/v1/repeaters'),
      apiFetch(`/api/v1/exercises/${exerciseId}/repeaters`),
    ]).then(([bl, bz, allReps, exReps]) => {
      setBundeslaender(bl);
      setBezirke(bz);
      const linked = allReps.filter((r: any) => r.is_linked);
      setLinkedRepeaters(linked);
      // Initialize per-BL defaults: first linked in that BL, else first overall
      const defaults: Record<string, number> = {};
      const ops: Record<string, string> = {};
      for (const b of bl) {
        const inBl = linked.find((r: any) => r.bundesland_code === b.code);
        const repId = inBl ? inBl.id : (linked[0]?.id ?? 0);
        defaults[b.code] = repId;
        // Load existing OP callsign from exercise_repeaters
        const exRep = exReps.find((er: any) => er.repeater_id === repId);
        ops[b.code] = exRep?.operator_callsign || '';
      }
      setBlRepSelection(defaults);
      setBlOpCallsigns(ops);
    }).catch(() => {});
  }, [exerciseId]);

  const saveOpCallsign = async (blCode: string, val: string) => {
    const repId = blRepSelection[blCode];
    if (!repId) return;
    try {
      // Ensure exercise_repeater exists, then update
      await apiFetch(`/api/v1/exercises/${exerciseId}/repeaters`, {
        method: 'POST',
        body: JSON.stringify({ repeater_id: repId, operator_callsign: val || null }),
      });
    } catch {
      // Already exists, just patch
      await apiFetch(`/api/v1/exercises/${exerciseId}/repeaters/${repId}`, {
        method: 'PATCH',
        body: JSON.stringify({ operator_callsign: val || null }),
      });
    }
  };

  const addRepeater = async (blCode: string) => {
    if (!newRepName && !newRepFreq) return;
    const name = newRepName || `Direkte ${newRepFreq}`;
    const freq = newRepFreq ? parseFloat(newRepFreq) : null;
    try {
      const rep = await apiFetch('/api/v1/repeaters', {
        method: 'POST',
        body: JSON.stringify({
          short_name: name,
          site_name: name,
          frequency_mhz: freq,
          callsign: newRepCallsign || null,
          band: freq ? (freq > 400 ? '70cm' : freq > 200 ? '23cm' : '2m') : null,
          type: 'repeater',
          bundesland_code: blCode,
        }),
      });
      setLinkedRepeaters(prev => [...prev, rep]);
      setNewRepName('');
      setNewRepFreq('');
      setNewRepCallsign('');
      setAddRepBl(null);
    } catch {}
  };

  const toggleBl = (code: string) => {
    setCollapsedBl(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
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
    if (!repeaterId) { alert('Kein Umsetzer ausgewählt'); return; }
    const operator = await getOrCreateOperator(form.callsign, form.operator);
    if (!operator) { alert('Rufzeichen ungültig (min. 3 Zeichen)'); return; }

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
      onReportCreated(report);
    } catch (err: any) {
      if (err.message?.includes('existiert')) {
        const existing = reports.find(r => r.operator_id === operator.id && r.repeater_id === repeaterId);
        if (existing) {
          const updated = await apiFetch(`/api/v1/exercises/${exerciseId}/reports/${existing.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ ...parsed, notes: form.notes || null }),
          });
          onReportUpdated(updated);
        }
      } else {
        console.error('Report error:', err);
        alert('Fehler: ' + (err.message || 'Unbekannt'));
      }
    }
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

  return (
    <div className="space-y-2">
      {bundeslaender.filter(bl => !bl.is_international).map(bl => {
        const blBezirke = bezirke.filter(b => b.bundesland_code === bl.code);
        const defaultRepId = blRepSelection[bl.code] || 0;
        // Match reports by bundesland_code OR by callsign prefix (OE8xxx → '08')
        const blReports = reports.filter(r => {
          if (r.bundesland_code === bl.code) return true;
          if (!r.bundesland_code && r.callsign) {
            const prefix = r.callsign.match(/^OE(\d)/);
            if (prefix && '0' + prefix[1] === bl.code) return true;
          }
          return false;
        });
        const isCollapsed = collapsedBl.has(bl.code);
        const reportCount = blReports.filter(r => !r.is_op_marker && r.readability).length;

        return (
          <div key={bl.code} className="bg-white rounded-lg shadow-sm">
            <div className="bg-gray-50 px-3 py-2 flex items-center justify-between border-b">
              <div
                onClick={() => toggleBl(bl.code)}
                className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 rounded px-1 -mx-1"
              >
                <span className="text-xs text-gray-400">{isCollapsed ? '▶' : '▼'}</span>
                <span className="font-medium text-sm">{bl.name}</span>
                <span className="bg-[#0d6efd] text-white text-xs px-1.5 py-0.5 rounded-full">{reportCount}</span>
              </div>
              <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => setAddRepBl(addRepBl === bl.code ? null : bl.code)}
                  className="text-xs text-gray-400 hover:text-blue-600"
                >
                  + Umsetzer
                </button>
                <label className="text-xs text-gray-500">OP:</label>
                <input
                  type="text"
                  value={blOpCallsigns[bl.code] || ''}
                  onChange={e => setBlOpCallsigns(prev => ({ ...prev, [bl.code]: e.target.value.toUpperCase() }))}
                  onBlur={e => saveOpCallsign(bl.code, e.target.value.toUpperCase())}
                  placeholder="Rufzeichen"
                  className="border border-gray-300 rounded px-1.5 py-0.5 text-xs font-mono uppercase w-24 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {!isCollapsed && (
              <div>
                {addRepBl === bl.code && (
                  <div className="px-3 py-2 bg-blue-50 border-b flex items-center gap-1 flex-wrap">
                    <input
                      type="text"
                      value={newRepName}
                      onChange={e => setNewRepName(e.target.value)}
                      placeholder="Name"
                      className="border border-gray-300 rounded px-1.5 py-0.5 text-xs w-28 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      autoFocus
                    />
                    <input
                      type="text"
                      value={newRepFreq}
                      onChange={e => setNewRepFreq(e.target.value)}
                      placeholder="MHz"
                      className="border border-gray-300 rounded px-1.5 py-0.5 text-xs font-mono w-20 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      value={newRepCallsign}
                      onChange={e => setNewRepCallsign(e.target.value.toUpperCase())}
                      placeholder="Rufz."
                      className="border border-gray-300 rounded px-1.5 py-0.5 text-xs font-mono uppercase w-20 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => addRepeater(bl.code)}
                      className="bg-green-600 hover:bg-green-700 text-white px-2 py-0.5 rounded text-xs"
                    >
                      OK
                    </button>
                    <button
                      onClick={() => { setAddRepBl(null); setNewRepName(''); setNewRepFreq(''); setNewRepCallsign(''); }}
                      className="text-gray-400 hover:text-gray-600 text-xs"
                    >
                      Abbrechen
                    </button>
                  </div>
                )}
                <div className="divide-y divide-gray-100">
                  {blBezirke.map(bz => {
                    const bzReports = blReports.filter(r => r.bezirk_code === bz.code);
                    return (
                      <BezirkRow
                        key={bz.code}
                        bezirk={bz}
                        reports={bzReports}
                        linkedRepeaters={linkedRepeaters}
                        defaultRepeaterId={defaultRepId}
                        onSubmit={(repeaterId, form) => handleBezirkSubmit(bz.code, repeaterId, form)}
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
                  {/* Reports without matching bezirk — shown directly as list items */}
                  {(() => {
                    const bzCodes = new Set(blBezirke.map(b => b.code));
                    const unassigned = blReports.filter(r => !r.bezirk_code || !bzCodes.has(r.bezirk_code));
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
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface BezirkRowProps {
  bezirk: any;
  reports: any[];
  linkedRepeaters: any[];
  defaultRepeaterId: number;
  onSubmit: (repeaterId: number, form: EntryForm) => void;
  onEdit: (report: any) => void;
  onDelete: (id: number) => void;
  editingId: number | null;
  editForm: EntryForm;
  onEditChange: (form: EntryForm) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
}

function BezirkRow({ bezirk, reports, linkedRepeaters, defaultRepeaterId, onSubmit, onEdit, onDelete, editingId, editForm, onEditChange, onEditSave, onEditCancel }: BezirkRowProps) {
  const [form, setForm] = useState<EntryForm>({ callsign: '', operator: null, rapport: '5/9', notes: '' });
  const [repeaterId, setRepeaterId] = useState(defaultRepeaterId);
  const callsignRef = useRef<CallsignInputRef>(null);

  useEffect(() => {
    if (defaultRepeaterId && !repeaterId) setRepeaterId(defaultRepeaterId);
  }, [defaultRepeaterId]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    alert(`Submit: cs="${form.callsign}" rap="${form.rapport}" rep=${repeaterId}`);
    if (!form.callsign && !form.operator) return;
    if (!repeaterId) return;
    onSubmit(repeaterId, form);
    setForm({ callsign: '', operator: null, rapport: '5/9', notes: '' });
    setTimeout(() => callsignRef.current?.focus(), 50);
  };

  return (
    <div className="px-3 py-1.5">
      {bezirk.code !== '??' && (
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-xs font-mono px-1.5 py-0.5 rounded text-white ${bezirk.is_capital ? 'bg-[#dc3545]' : 'bg-[#6c757d]'}`}>
            {bezirk.code}
          </span>
          <span className="text-xs text-gray-500">{bezirk.name}</span>
          {reports.length > 0 && <span className="text-xs text-gray-400">({reports.length})</span>}
        </div>
      )}

      {reports.length > 0 && (
        <table className="w-full text-xs mb-1">
          <tbody>
            {reports.map((r, idx) => (
              <tr key={r.id} className="hover:bg-blue-50 group">
                {editingId === r.id ? (
                  <td colSpan={5} className="py-0.5">
                    <div className="flex items-center gap-1 bg-blue-50 rounded p-1">
                      <span className="font-mono font-medium">{r.callsign}</span>
                      <input value={editForm.rapport} onChange={e => onEditChange({ ...editForm, rapport: e.target.value.toUpperCase() })} className="border rounded px-1 py-0.5 font-mono text-xs w-20" autoFocus />
                      <input value={editForm.notes} onChange={e => onEditChange({ ...editForm, notes: e.target.value })} placeholder="Sonst." className="border rounded px-1 py-0.5 text-xs w-20" />
                      <button onClick={onEditSave} className="text-green-600 text-xs font-bold">OK</button>
                      <button onClick={onEditCancel} className="text-gray-400 text-xs">X</button>
                    </div>
                  </td>
                ) : (
                  <>
                    <td className="py-0.5 text-gray-400 w-4">{idx + 1}</td>
                    <td className="py-0.5 font-mono font-medium cursor-pointer" onClick={() => onEdit(r)}>{r.callsign}</td>
                    <td className="py-0.5 font-mono text-gray-500 w-24 cursor-pointer" onClick={() => onEdit(r)}>
                      {r.readability && r.strength ? `${r.readability}/${r.strength}${r.db_over_s9 || ''}` : '—'}
                    </td>
                    <td className="py-0.5 text-gray-500 cursor-pointer" onClick={() => onEdit(r)}>{r.notes || ''}</td>
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
        {linkedRepeaters.length > 0 && (
          <select
            value={repeaterId || ''}
            onChange={e => setRepeaterId(parseInt(e.target.value))}
            className="border border-gray-300 rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {linkedRepeaters.map(r => (
              <option key={r.id} value={r.id}>
                {r.site_name || r.short_name}
              </option>
            ))}
          </select>
        )}
        <CallsignInput
          ref={callsignRef}
          value={form.callsign}
          onChange={v => setForm(f => ({ ...f, callsign: v }))}
          onSelect={op => setForm(f => ({ ...f, operator: op, callsign: op.callsign }))}
          className="w-28"
        />
        <input
          type="text"
          value={form.rapport}
          onChange={e => setForm(f => ({ ...f, rapport: e.target.value.toUpperCase() }))}
          placeholder="5/9"
          className="border border-gray-300 rounded px-1.5 py-0.5 font-mono text-xs w-20 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
          className="border border-gray-300 rounded px-1.5 py-0.5 text-xs flex-1 min-w-[60px] focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button type="submit" className="bg-[#c8102e] hover:bg-[#a00d24] text-white px-2 py-0.5 rounded text-xs">
          +
        </button>
      </form>
    </div>
  );
}
