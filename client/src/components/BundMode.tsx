import { useState, useEffect, type FormEvent } from 'react';
import { apiFetch } from '../services/api';
import CallsignInput from './CallsignInput';

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
  const [collapsedBl, setCollapsedBl] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<EntryForm>({ callsign: '', operator: null, rapport: '', notes: '' });

  useEffect(() => {
    apiFetch('/api/v1/reference/bundeslaender').then(setBundeslaender).catch(() => {});
    apiFetch('/api/v1/reference/bezirke').then(setBezirke).catch(() => {});
    apiFetch('/api/v1/repeaters').then((all: any[]) => {
      setLinkedRepeaters(all.filter(r => r.is_linked));
    }).catch(() => {});
  }, []);

  // Map each BL to its OE-Link repeater: first linked in that BL, else first overall
  const blRepeaterMap: Record<string, number> = {};
  for (const bl of bundeslaender) {
    const inBl = linkedRepeaters.find(r => r.bundesland_code === bl.code);
    blRepeaterMap[bl.code] = inBl ? inBl.id : (linkedRepeaters[0]?.id ?? 0);
  }

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

  const handleBezirkSubmit = async (bezirkCode: string, bundeslandCode: string, form: EntryForm) => {
    if (!form.operator) return;
    const repeaterId = blRepeaterMap[bundeslandCode];
    if (!repeaterId) return;

    const parsed = parseRapport(form.rapport);

    try {
      const report = await apiFetch(`/api/v1/exercises/${exerciseId}/reports`, {
        method: 'POST',
        body: JSON.stringify({
          operator_id: form.operator.id,
          repeater_id: repeaterId,
          ...parsed,
          notes: form.notes || null,
        }),
      });
      onReportCreated(report);
    } catch (err: any) {
      if (err.message?.includes('existiert')) {
        const existing = reports.find(r => r.operator_id === form.operator.id && r.repeater_id === repeaterId);
        if (existing) {
          const updated = await apiFetch(`/api/v1/exercises/${exerciseId}/reports/${existing.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ ...parsed, notes: form.notes || null }),
          });
          onReportUpdated(updated);
        }
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

  const linkedRepIds = new Set(linkedRepeaters.map(r => r.id));

  return (
    <div className="space-y-2">
      {bundeslaender.filter(bl => !bl.is_international).map(bl => {
        const blBezirke = bezirke.filter(b => b.bundesland_code === bl.code);
        const blReports = reports.filter(r => r.bundesland_code === bl.code && linkedRepIds.has(r.repeater_id));
        const isCollapsed = collapsedBl.has(bl.code);
        const reportCount = blReports.filter(r => !r.is_op_marker && r.readability).length;
        const blRep = linkedRepeaters.find(r => r.id === blRepeaterMap[bl.code]);

        return (
          <div key={bl.code} className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div
              onClick={() => toggleBl(bl.code)}
              className="bg-gray-50 px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-gray-100 border-b"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">{isCollapsed ? '▶' : '▼'}</span>
                <span className="font-medium text-sm">{bl.name}</span>
                <span className="bg-[#0d6efd] text-white text-xs px-1.5 py-0.5 rounded-full">{reportCount}</span>
              </div>
              {blRep && (
                <span className="text-xs text-blue-600 font-medium">
                  {blRep.site_name || blRep.short_name} ({blRep.callsign || blRep.short_name})
                </span>
              )}
            </div>

            {!isCollapsed && (
              <div className="divide-y divide-gray-100">
                {blBezirke.map(bz => {
                  const bzReports = blReports.filter(r => r.bezirk_code === bz.code);
                  return (
                    <BezirkRow
                      key={bz.code}
                      bezirk={bz}
                      reports={bzReports}
                      onSubmit={(form) => handleBezirkSubmit(bz.code, bl.code, form)}
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
  onSubmit: (form: EntryForm) => void;
  onEdit: (report: any) => void;
  onDelete: (id: number) => void;
  editingId: number | null;
  editForm: EntryForm;
  onEditChange: (form: EntryForm) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
}

function BezirkRow({ bezirk, reports, onSubmit, onEdit, onDelete, editingId, editForm, onEditChange, onEditSave, onEditCancel }: BezirkRowProps) {
  const [form, setForm] = useState<EntryForm>({ callsign: '', operator: null, rapport: '', notes: '' });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.operator) return;
    onSubmit(form);
    setForm({ callsign: '', operator: null, rapport: '', notes: '' });
  };

  return (
    <div className="px-3 py-1.5">
      <div className="flex items-center gap-2 mb-1">
        <span className={`text-xs font-mono px-1.5 py-0.5 rounded text-white ${bezirk.is_capital ? 'bg-[#dc3545]' : 'bg-[#6c757d]'}`}>
          {bezirk.code}
        </span>
        <span className="text-xs text-gray-500">{bezirk.name}</span>
      </div>

      <div className="flex flex-wrap gap-1 mb-1">
        {reports.map(r => (
          <div key={r.id} className="group">
            {editingId === r.id ? (
              <div className="flex items-center gap-1 bg-amber-50 rounded p-1">
                <input value={editForm.rapport} onChange={e => onEditChange({ ...editForm, rapport: e.target.value.toUpperCase() })} className="border rounded px-1 py-0.5 font-mono text-xs w-20" />
                <button onClick={onEditSave} className="text-green-600 text-xs font-bold">OK</button>
                <button onClick={onEditCancel} className="text-gray-400 text-xs">X</button>
              </div>
            ) : (
              <span
                onClick={() => onEdit(r)}
                className="inline-flex items-center gap-1 bg-gray-50 hover:bg-amber-50 rounded px-1.5 py-0.5 cursor-pointer text-xs"
              >
                <span className="font-mono font-medium">{r.callsign}</span>
                {r.readability && r.strength && (
                  <span className="text-gray-500">{r.readability}/{r.strength}{r.db_over_s9 || ''}</span>
                )}
                {r.notes && <span className="text-amber-600">({r.notes})</span>}
                <button
                  onClick={e => { e.stopPropagation(); onDelete(r.id); }}
                  className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100"
                >
                  x
                </button>
              </span>
            )}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-1">
        <CallsignInput
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
          className="border border-gray-300 rounded px-1.5 py-0.5 font-mono text-xs w-20 focus:outline-none focus:ring-1 focus:ring-amber-500"
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
          className="border border-gray-300 rounded px-1.5 py-0.5 text-xs flex-1 min-w-[60px] focus:outline-none focus:ring-1 focus:ring-amber-500"
        />
        <button type="submit" className="bg-[#5b3a1a] hover:bg-[#7a5230] text-white px-2 py-0.5 rounded text-xs">
          +
        </button>
      </form>
    </div>
  );
}
