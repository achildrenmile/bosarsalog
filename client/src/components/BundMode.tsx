import { useState, useEffect, useRef, type FormEvent } from 'react';
import { apiFetch, getOrCreateOperator } from '../services/api';
import { getSocket } from '../services/socket';
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
  opName: string;
  opQth: string;
  bezirkCode: string;
  suffix?: string;
}

const SUFFIXES = ['/m', '/p', '/am', '/mm'] as const;

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
  const [editForm, setEditForm] = useState<EntryForm>({ callsign: '', operator: null, rapport: '', notes: '', opName: '', opQth: '', bezirkCode: '', suffix: '' });
  const [dragReportId, setDragReportId] = useState<number | null>(null);

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

    const socket = getSocket();
    const handleOpCallsignUpdated = (data: { exercise_id: string; repeater_id: number; operator_callsign: string }) => {
      if (data.exercise_id !== exerciseId) return;
      // Map repeater_id back to blCode via current blRepSelection
      setBlRepSelection(sel => {
        for (const [blCode, repId] of Object.entries(sel)) {
          if (repId === data.repeater_id) {
            setBlOpCallsigns(prev => ({ ...prev, [blCode]: data.operator_callsign || '' }));
          }
        }
        return sel;
      });
    };
    socket.on('op_callsign_updated', handleOpCallsignUpdated);
    return () => { socket.off('op_callsign_updated', handleOpCallsignUpdated); };
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
    getSocket().emit('op_callsign_updated', { exercise_id: exerciseId, repeater_id: repId, operator_callsign: val });
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
    try {
      if (!repeaterId) return;
      const operator = await getOrCreateOperator(form.callsign, form.operator);
      if (!operator) return;

      const parsed = parseRapport(form.rapport);

      try {
        const report = await apiFetch(`/api/v1/exercises/${exerciseId}/reports`, {
          method: 'POST',
          body: JSON.stringify({
            operator_id: operator.id,
            repeater_id: repeaterId,
            ...parsed,
            notes: form.notes || null,
            bezirk_code: (bezirkCode && bezirkCode !== '??') ? bezirkCode : null,
            suffix: form.suffix || null,
          }),
        });
        onReportCreated(report);
      } catch (err: any) {
        if (err.message?.includes('existiert') && err.data?.existing_report) {
          const existing = err.data.existing_report;
          const updated = await apiFetch(`/api/v1/exercises/${exerciseId}/reports/${existing.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ ...parsed, notes: form.notes || null, bezirk_code: (bezirkCode && bezirkCode !== '??') ? bezirkCode : null, suffix: form.suffix || null }),
          });
          onReportUpdated(updated);
        }
      }
    } catch {
    }
  };

  const handleEdit = (report: any) => {
    setEditingId(report.id);
    setEditForm({
      callsign: report.callsign,
      operator: { id: report.operator_id, callsign: report.callsign, name: report.operator_name || null, qth: report.operator_qth || null },
      rapport: report.readability && report.strength ? `${report.readability}/${report.strength}${report.db_over_s9 || ''}` : '',
      notes: report.notes || '',
      opName: report.operator_name || '',
      opQth: report.operator_qth || '',
      bezirkCode: report.bezirk_code || '',
      suffix: report.suffix || '',
    });
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    const parsed = parseRapport(editForm.rapport);
    try {
      // Save operator name/qth if changed
      if (editForm.operator?.id) {
        const nameChanged = (editForm.opName || '') !== (editForm.operator.name || '');
        const qthChanged = (editForm.opQth || '') !== (editForm.operator.qth || '');
        if (nameChanged || qthChanged) {
          const patch: any = {};
          if (nameChanged) patch.name = editForm.opName || null;
          if (qthChanged) patch.qth = editForm.opQth || null;
          await apiFetch(`/api/v1/operators/${editForm.operator.id}`, {
            method: 'PATCH',
            body: JSON.stringify(patch),
          });
        }
      }
      const updated = await apiFetch(`/api/v1/exercises/${exerciseId}/reports/${editingId}`, {
        method: 'PATCH',
        body: JSON.stringify({ ...parsed, notes: editForm.notes || null, bezirk_code: editForm.bezirkCode || null, suffix: editForm.suffix || null }),
      });
      if (editForm.opName !== undefined) updated.operator_name = editForm.opName || null;
      if (editForm.opQth !== undefined) updated.operator_qth = editForm.opQth || null;
      onReportUpdated(updated);
      setEditingId(null);
    } catch {}
  };

  const handleMoveToBezirk = async (reportId: number, newBezirkCode: string | null) => {
    try {
      const updated = await apiFetch(`/api/v1/exercises/${exerciseId}/reports/${reportId}`, {
        method: 'PATCH',
        body: JSON.stringify({ bezirk_code: newBezirkCode }),
      });
      onReportUpdated(updated);
    } catch {}
  };

  const handleDelete = async (reportId: number) => {
    if (!confirm('Rapport löschen?')) return;
    try {
      await apiFetch(`/api/v1/exercises/${exerciseId}/reports/${reportId}`, { method: 'DELETE' });
      onReportDeleted(reportId);
    } catch {}
  };

  const domesticBlCodes = new Set(bundeslaender.filter(b => !b.is_international).map(b => b.code));

  return (
    <div className="space-y-2">
      {bundeslaender.filter(bl => !bl.is_international).map(bl => {
        const blBezirke = bezirke.filter(b => b.bundesland_code === bl.code);
        const defaultRepId = blRepSelection[bl.code] || 0;
        // Match reports by bezirk's Bundesland, only for linked repeaters
        const blBezirkCodes = new Set(blBezirke.map(b => b.code));
        const blReports = reports.filter(r => {
          if (!r.repeater_is_linked) return false;
          // Primary: match by bezirk code
          if (r.bezirk_code && blBezirkCodes.has(r.bezirk_code)) return true;
          // Fallback for null bezirk_code: use operator BL (if domestic), else repeater BL
          if (!r.bezirk_code) {
            const effectiveBl = domesticBlCodes.has(r.bundesland_code) ? r.bundesland_code : r.repeater_bundesland_code;
            return effectiveBl === bl.code;
          }
          return false;
        });
        const isCollapsed = collapsedBl.has(bl.code);
        const reportCount = blReports.filter(r => !r.is_op_marker && r.readability).length;

        return (
          <div key={bl.code} className="bg-white rounded-lg shadow-sm">
            <div className="bg-gray-50 px-2 sm:px-3 py-2 flex flex-wrap items-center justify-between border-b gap-1">
              <div
                onClick={() => toggleBl(bl.code)}
                className="flex items-center gap-1.5 sm:gap-2 cursor-pointer hover:bg-gray-100 rounded px-1 -mx-1 min-w-0"
              >
                <span className="text-xs text-gray-400">{isCollapsed ? '▶' : '▼'}</span>
                <span className="font-medium text-xs sm:text-sm truncate">OE{parseInt(bl.code)} {bl.name}</span>
                <span className="bg-[#0d6efd] text-white text-xs px-1.5 py-0.5 rounded-full flex-shrink-0">{reportCount}</span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => setAddRepBl(addRepBl === bl.code ? null : bl.code)}
                  className="text-xs text-gray-400 hover:text-blue-600 hidden sm:inline"
                >
                  + Umsetzer
                </button>
                <label className={`text-xs ${blOpCallsigns[bl.code] ? 'text-gray-500' : 'text-[#c8102e] font-semibold'}`}>OP:</label>
                <input
                  type="text"
                  value={blOpCallsigns[bl.code] || ''}
                  onChange={e => setBlOpCallsigns(prev => ({ ...prev, [bl.code]: e.target.value.toUpperCase() }))}
                  onBlur={e => saveOpCallsign(bl.code, e.target.value.toUpperCase())}
                  placeholder="Rufz."
                  className={`border rounded px-1.5 py-0.5 text-xs font-mono uppercase w-20 sm:w-24 focus:outline-none focus:ring-1 focus:ring-blue-500 ${blOpCallsigns[bl.code] ? 'border-gray-300' : 'border-[#c8102e] placeholder-[#c8102e]/60'}`}
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
                        availableBezirke={blBezirke}
                        linkedRepeaters={linkedRepeaters}
                        defaultRepeaterId={defaultRepId}
                        onSubmit={(repeaterId, form) => handleBezirkSubmit(bz.code, repeaterId, form)}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onMoveToBezirk={handleMoveToBezirk}
                        editingId={editingId}
                        editForm={editForm}
                        onEditChange={setEditForm}
                        onEditSave={handleUpdate}
                        onEditCancel={() => setEditingId(null)}
                        dragReportId={dragReportId}
                        onDragStart={setDragReportId}
                        onDragEnd={() => setDragReportId(null)}
                      />
                    );
                  })}
                  {/* Sonstige — reports without matching bezirk + entry form */}
                  {(() => {
                    const bzCodes = new Set(blBezirke.map(b => b.code));
                    const unassigned = blReports.filter(r => !r.bezirk_code || !bzCodes.has(r.bezirk_code));
                    return (
                      <BezirkRow
                        bezirk={{ code: '??', name: 'Sonstige', is_capital: false }}
                        reports={unassigned}
                        availableBezirke={blBezirke}
                        linkedRepeaters={linkedRepeaters}
                        defaultRepeaterId={defaultRepId}
                        onSubmit={(repeaterId, form) => handleBezirkSubmit('??', repeaterId, form)}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onMoveToBezirk={handleMoveToBezirk}
                        editingId={editingId}
                        editForm={editForm}
                        onEditChange={setEditForm}
                        onEditSave={handleUpdate}
                        onEditCancel={() => setEditingId(null)}
                        dragReportId={dragReportId}
                        onDragStart={setDragReportId}
                        onDragEnd={() => setDragReportId(null)}
                      />
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
  availableBezirke: any[];
  linkedRepeaters: any[];
  defaultRepeaterId: number;
  onSubmit: (repeaterId: number, form: EntryForm) => void;
  onEdit: (report: any) => void;
  onDelete: (id: number) => void;
  onMoveToBezirk: (reportId: number, bezirkCode: string | null) => void;
  editingId: number | null;
  editForm: EntryForm;
  onEditChange: (form: EntryForm) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
  dragReportId: number | null;
  onDragStart: (reportId: number) => void;
  onDragEnd: () => void;
}

function BezirkRow({ bezirk, reports, availableBezirke, linkedRepeaters, defaultRepeaterId, onSubmit, onEdit, onDelete, onMoveToBezirk, editingId, editForm, onEditChange, onEditSave, onEditCancel, dragReportId, onDragStart, onDragEnd }: BezirkRowProps) {
  const [form, setForm] = useState<EntryForm>({ callsign: '', operator: null, rapport: '5/9', notes: '', opName: '', opQth: '', bezirkCode: '', suffix: '' });
  const [repeaterId, setRepeaterId] = useState(defaultRepeaterId);
  const [dragOver, setDragOver] = useState(false);
  const callsignRef = useRef<CallsignInputRef>(null);
  const rapportRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (defaultRepeaterId && !repeaterId) setRepeaterId(defaultRepeaterId);
  }, [defaultRepeaterId]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.callsign && !form.operator) return;
    if (!repeaterId) return;
    onSubmit(repeaterId, form);
    setForm({ callsign: '', operator: null, rapport: '5/9', notes: '', opName: '', opQth: '', bezirkCode: '', suffix: '' });
    setTimeout(() => callsignRef.current?.focus(), 50);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (dragReportId) {
      const targetCode = bezirk.code === '??' ? null : bezirk.code;
      onMoveToBezirk(dragReportId, targetCode);
    }
  };

  const saveOperatorField = (field: 'name' | 'qth', value: string) => {
    if (!form.operator?.id) return;
    const original = field === 'name' ? (form.operator.name || '') : (form.operator.qth || '');
    if (value === original) return;
    apiFetch(`/api/v1/operators/${form.operator.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ [field]: value || null }),
    }).then(() => {
      setForm(f => ({ ...f, operator: { ...f.operator, [field]: value || null } }));
    }).catch(() => {});
  };

  return (
    <div
      className={`px-2 sm:px-3 py-1.5 transition-colors ${dragOver && dragReportId ? 'bg-blue-100 ring-2 ring-blue-400 ring-inset' : ''}`}
      onDragOver={e => { if (dragReportId) { e.preventDefault(); setDragOver(true); } }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
        <span className={`text-xs font-mono px-1.5 py-0.5 rounded text-white ${bezirk.code === '??' ? 'bg-[#ffc107] text-gray-800' : bezirk.is_capital ? 'bg-[#dc3545]' : 'bg-[#6c757d]'}`}>
          {bezirk.code === '??' ? '??' : bezirk.code}
        </span>
        <span className="text-xs text-gray-500 truncate">{bezirk.name}</span>
        {reports.length > 0 && <span className="text-xs text-gray-400 flex-shrink-0">({reports.length})</span>}
      </div>

      {reports.length > 0 && (
        <table className="w-full text-xs mb-1">
          <tbody>
            {reports.map((r, idx) => (
              <tr
                key={r.id}
                className={`hover:bg-blue-50 group ${dragReportId === r.id ? 'opacity-40' : ''}`}
                draggable={editingId !== r.id}
                onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; onDragStart(r.id); }}
                onDragEnd={onDragEnd}
              >
                {editingId === r.id ? (
                  <td colSpan={6} className="py-0.5">
                    <div className="flex items-center gap-1 bg-blue-50 rounded p-1 flex-wrap" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onEditSave(); } }}>
                      <span className="font-mono font-medium">{r.callsign}</span>
                      <input value={editForm.opName} onChange={e => onEditChange({ ...editForm, opName: e.target.value })} placeholder="Name" className="border rounded px-1 py-0.5 text-xs w-16 sm:w-20 hidden sm:block" />
                      <input value={editForm.opQth} onChange={e => onEditChange({ ...editForm, opQth: e.target.value })} placeholder="QTH" className="border rounded px-1 py-0.5 text-xs w-14 sm:w-16 hidden sm:block" />
                      <input value={editForm.rapport} onChange={e => onEditChange({ ...editForm, rapport: e.target.value.toUpperCase() })} className="border rounded px-1 py-0.5 font-mono text-xs w-16 sm:w-20" autoFocus />
                      <input value={editForm.notes} onChange={e => onEditChange({ ...editForm, notes: e.target.value })} placeholder="Sonst." className="border rounded px-1 py-0.5 text-xs w-16 sm:w-20" />
                      <select
                        value={editForm.bezirkCode}
                        onChange={e => onEditChange({ ...editForm, bezirkCode: e.target.value })}
                        className="border rounded px-1 py-0.5 text-xs w-14 sm:w-16"
                        title="Bezirk"
                      >
                        <option value="">??</option>
                        {availableBezirke.map(bz => <option key={bz.code} value={bz.code}>{bz.code}</option>)}
                      </select>
                      <button onClick={onEditSave} className="text-green-600 text-xs font-bold">OK</button>
                      <button onClick={onEditCancel} className="text-gray-400 text-xs">X</button>
                    </div>
                  </td>
                ) : (
                  <>
                    <td className="py-0.5 text-gray-400 w-4 cursor-grab">{idx + 1}</td>
                    <td className="py-0.5 cursor-pointer" onClick={() => onEdit(r)}>
                      <span className="font-mono font-medium">{r.callsign}{r.suffix || ''}</span>
                      {r.operator_name && <span className="ml-1 text-gray-500 text-xs">{r.operator_name}</span>}
                      {r.operator_qth && <span className="ml-1 text-gray-400 text-xs hidden sm:inline">{r.operator_qth}</span>}
                    </td>
                    <td className="py-0.5 text-blue-600 text-xs cursor-pointer hidden sm:table-cell" onClick={() => onEdit(r)}>{r.repeater_name || ''}</td>
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
        {linkedRepeaters.length > 0 && (
          <select
            value={repeaterId || ''}
            onChange={e => setRepeaterId(parseInt(e.target.value))}
            className="border border-gray-300 rounded px-1 py-0.5 text-xs max-w-[80px] sm:max-w-none focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {linkedRepeaters.map(r => (
              <option key={r.id} value={r.id}>
                {r.site_name || r.short_name}{r.callsign ? ` (${r.callsign})` : ''}
              </option>
            ))}
          </select>
        )}
        <CallsignInput
          ref={callsignRef}
          value={form.callsign}
          onChange={v => setForm(f => ({ ...f, callsign: v, operator: null, opName: '', opQth: '' }))}
          onSelect={op => {
            setForm(f => ({ ...f, operator: op, callsign: op.callsign, opName: op.name || '', opQth: op.qth || '' }));
            setTimeout(() => { const el = rapportRef.current; if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, 50);
          }}
          onEnter={() => setTimeout(() => { const el = rapportRef.current; if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, 50)}
          className="w-24 sm:w-28"
        />
        <div className="flex gap-0.5">
          {SUFFIXES.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setForm(f => ({ ...f, suffix: f.suffix === s ? '' : s }))}
              className={`px-1 py-0.5 rounded text-xs font-mono border ${form.suffix === s ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200'}`}
              title={s}
            >
              {s.slice(1)}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={form.opName}
          onChange={e => setForm(f => ({ ...f, opName: e.target.value }))}
          onBlur={e => saveOperatorField('name', e.target.value)}
          placeholder="Name"
          className="border border-gray-300 rounded px-1.5 py-0.5 text-xs w-20 sm:w-24 focus:outline-none focus:ring-1 focus:ring-blue-500 hidden sm:block"
        />
        <input
          type="text"
          value={form.opQth}
          onChange={e => setForm(f => ({ ...f, opQth: e.target.value }))}
          onBlur={e => saveOperatorField('qth', e.target.value)}
          placeholder="QTH"
          className="border border-gray-300 rounded px-1.5 py-0.5 text-xs w-16 sm:w-20 focus:outline-none focus:ring-1 focus:ring-blue-500 hidden sm:block"
        />
        <input
          ref={rapportRef}
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
        <button type="submit" title="Rapport speichern (Enter)" className="bg-[#c8102e] hover:bg-[#a00d24] text-white px-2 py-0.5 rounded text-xs flex-shrink-0">
          + ↵
        </button>
      </form>
    </div>
  );
}
