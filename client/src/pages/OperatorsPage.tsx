import { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../services/api';

export default function OperatorsPage() {
  const [operators, setOperators] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newOp, setNewOp] = useState({ callsign: '', name: '', qth: '', bezirk_code: '', bundesland_code: '', home_repeater: '' });
  const [page, setPage] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const load = async (q?: string, offset = 0) => {
    setLoading(true);
    try {
      if (q) {
        const results = await apiFetch(`/api/v1/operators?q=${encodeURIComponent(q)}`);
        setOperators(results);
        setTotal(results.length);
      } else {
        const data = await apiFetch(`/api/v1/operators?limit=50&offset=${offset}`);
        setOperators(data.operators);
        setTotal(data.total);
      }
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSearch = (q: string) => {
    setSearch(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(q), 300);
  };

  const handleSave = async (op: any) => {
    try {
      const updated = await apiFetch(`/api/v1/operators/${op.id}`, {
        method: 'PATCH',
        body: JSON.stringify(op),
      });
      setOperators(prev => prev.map(o => o.id === updated.id ? updated : o));
      setEditing(null);
    } catch {}
  };

  const handleAdd = async () => {
    try {
      const created = await apiFetch('/api/v1/operators', {
        method: 'POST',
        body: JSON.stringify(newOp),
      });
      setOperators(prev => [created, ...prev]);
      setShowAdd(false);
      setNewOp({ callsign: '', name: '', qth: '', bezirk_code: '', bundesland_code: '', home_repeater: '' });
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDelete = async (op: any) => {
    if (!confirm(`Rufzeichen ${op.callsign} wirklich löschen?`)) return;
    try {
      await apiFetch(`/api/v1/operators/${op.id}`, { method: 'DELETE' });
      setOperators(prev => prev.filter(o => o.id !== op.id));
      setTotal(t => t - 1);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handlePage = (dir: number) => {
    const newPage = page + dir;
    setPage(newPage);
    load(undefined, newPage * 50);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg sm:text-xl font-bold text-[#1e3a5f]">Rufzeichen-Register</h1>
        <button onClick={() => setShowAdd(true)} className="bg-[#c8102e] hover:bg-[#a00d24] text-white px-2 sm:px-3 py-1.5 rounded text-xs sm:text-sm flex-shrink-0">
          + Neu
        </button>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={e => handleSearch(e.target.value)}
          placeholder="Rufzeichen, Name oder QTH suchen..."
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
        />
        <span className="text-sm text-gray-500">{total} Einträge</span>
      </div>

      {showAdd && (
        <div className="bg-white rounded-lg shadow p-4 space-y-2">
          <h3 className="font-medium text-sm">Neues Rufzeichen anlegen</h3>
          <div className="flex gap-2 flex-wrap">
            <input value={newOp.callsign} onChange={e => setNewOp(p => ({ ...p, callsign: e.target.value.toUpperCase() }))} placeholder="Rufzeichen" className="border rounded px-2 py-1 text-sm font-mono uppercase w-28" />
            <input value={newOp.name} onChange={e => setNewOp(p => ({ ...p, name: e.target.value }))} placeholder="Name" className="border rounded px-2 py-1 text-sm w-32" />
            <input value={newOp.qth} onChange={e => setNewOp(p => ({ ...p, qth: e.target.value }))} placeholder="QTH" className="border rounded px-2 py-1 text-sm w-32" />
            <input value={newOp.bezirk_code} onChange={e => setNewOp(p => ({ ...p, bezirk_code: e.target.value.toUpperCase() }))} placeholder="Bezirk" className="border rounded px-2 py-1 text-sm w-16 uppercase" />
            <input value={newOp.bundesland_code} onChange={e => setNewOp(p => ({ ...p, bundesland_code: e.target.value }))} placeholder="BL" className="border rounded px-2 py-1 text-sm w-12" />
            <input value={newOp.home_repeater} onChange={e => setNewOp(p => ({ ...p, home_repeater: e.target.value }))} placeholder="Repeater" className="border rounded px-2 py-1 text-sm w-28" />
            <button onClick={handleAdd} className="bg-green-600 text-white px-3 py-1 rounded text-sm">Anlegen</button>
            <button onClick={() => setShowAdd(false)} className="text-gray-500 text-sm">Abbrechen</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <table className="w-full text-xs sm:text-sm min-w-[400px]">
          <thead className="bg-[#1e3a5f] text-white">
            <tr>
              <th className="px-2 sm:px-3 py-2 text-left">Rufzeichen</th>
              <th className="px-2 sm:px-3 py-2 text-left">Name</th>
              <th className="px-2 sm:px-3 py-2 text-left hidden sm:table-cell">QTH</th>
              <th className="px-2 sm:px-3 py-2 text-left hidden md:table-cell">Repeater</th>
              <th className="px-2 sm:px-3 py-2 text-left">Bezirk</th>
              <th className="px-2 sm:px-3 py-2 text-left hidden sm:table-cell">BL</th>
              <th className="px-2 sm:px-3 py-2 text-left hidden md:table-cell">Ausstattung</th>
              <th className="px-2 sm:px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {operators.map(op => (
              <tr key={op.id} className="border-t hover:bg-blue-50">
                {editing?.id === op.id ? (
                  <>
                    <td className="px-3 py-1"><input value={editing.callsign} onChange={e => setEditing({ ...editing, callsign: e.target.value.toUpperCase() })} className="border rounded px-1 py-0.5 font-mono text-xs w-24 uppercase" /></td>
                    <td className="px-3 py-1"><input value={editing.name || ''} onChange={e => setEditing({ ...editing, name: e.target.value })} className="border rounded px-1 py-0.5 text-xs w-24" /></td>
                    <td className="px-3 py-1"><input value={editing.qth || ''} onChange={e => setEditing({ ...editing, qth: e.target.value })} className="border rounded px-1 py-0.5 text-xs w-24" /></td>
                    <td className="px-3 py-1"><input value={editing.home_repeater || ''} onChange={e => setEditing({ ...editing, home_repeater: e.target.value })} className="border rounded px-1 py-0.5 text-xs w-24" /></td>
                    <td className="px-3 py-1"><input value={editing.bezirk_code || ''} onChange={e => setEditing({ ...editing, bezirk_code: e.target.value.toUpperCase() })} className="border rounded px-1 py-0.5 text-xs w-12 uppercase" /></td>
                    <td className="px-3 py-1"><input value={editing.bundesland_code || ''} onChange={e => setEditing({ ...editing, bundesland_code: e.target.value })} className="border rounded px-1 py-0.5 text-xs w-10" /></td>
                    <td className="px-3 py-1"><input value={editing.equipment || ''} onChange={e => setEditing({ ...editing, equipment: e.target.value })} className="border rounded px-1 py-0.5 text-xs w-24" /></td>
                    <td className="px-3 py-1 flex gap-1">
                      <button onClick={() => handleSave(editing)} className="text-green-600 text-xs font-bold">OK</button>
                      <button onClick={() => setEditing(null)} className="text-gray-400 text-xs">X</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-2 sm:px-3 py-1.5 font-mono font-medium">{op.callsign}</td>
                    <td className="px-2 sm:px-3 py-1.5">{op.name}</td>
                    <td className="px-2 sm:px-3 py-1.5 text-gray-500 hidden sm:table-cell">{op.qth}</td>
                    <td className="px-2 sm:px-3 py-1.5 text-gray-500 text-xs hidden md:table-cell">{op.home_repeater}</td>
                    <td className="px-2 sm:px-3 py-1.5">
                      {op.bezirk_code && (
                        <span className="text-xs bg-gray-200 rounded px-1">{op.bezirk_code}</span>
                      )}
                    </td>
                    <td className="px-2 sm:px-3 py-1.5 text-gray-500 hidden sm:table-cell">{op.bundesland_code}</td>
                    <td className="px-2 sm:px-3 py-1.5 text-xs text-gray-400 hidden md:table-cell">{op.equipment}</td>
                    <td className="px-2 sm:px-3 py-1.5 flex gap-2">
                      <button onClick={() => setEditing({ ...op })} className="text-blue-700 hover:underline text-xs">
                        Bearb.
                      </button>
                      <button onClick={() => handleDelete(op)} className="text-red-500 hover:underline text-xs">
                        Löschen
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!search && (
        <div className="flex items-center justify-center gap-4">
          <button onClick={() => handlePage(-1)} disabled={page === 0} className="text-sm text-gray-500 hover:text-gray-800 disabled:opacity-30">
            Zurück
          </button>
          <span className="text-sm text-gray-400">Seite {page + 1}</span>
          <button onClick={() => handlePage(1)} disabled={operators.length < 50} className="text-sm text-gray-500 hover:text-gray-800 disabled:opacity-30">
            Weiter
          </button>
        </div>
      )}
    </div>
  );
}
