import { useState, useCallback } from 'react';

interface ParsedRow {
  callsign: string;
  suffix: string | null;
  name: string | null;
  qth: string | null;
  bezirk_code: string | null;
  locator: string | null;
  readability: number | null;
  strength: number | null;
  db_over_s9: string | null;
  repeater_name: string | null;
  notstrom: boolean;
  info: string | null;
  bundesland_section: string;
  matched_repeater_id: number | null;
  is_duplicate: boolean;
  issues: string[];
}

interface PreviewData {
  total: number;
  rows: ParsedRow[];
  exercise_repeaters: { id: number; name: string }[];
}

interface Props {
  exerciseId: string;
  onClose: () => void;
  onImported: (reports: any[]) => void;
}

export default function EmHamImport({ exerciseId, onClose, onImported }: Props) {
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{ created: number; skipped: number; duplicates: number } | null>(null);

  const handleUpload = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/v1/exercises/${exerciseId}/import-emham`, {
        method: 'POST',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: formData,
      });
      if (res.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('admin');
        window.location.href = '/login';
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Fehler' }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data: PreviewData = await res.json();
      setPreview(data);
      setFilename(file.name);
      setStep('preview');
    } catch (err: any) {
      setError(err.message || 'Upload fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  }, [exerciseId]);

  const handleConfirm = useCallback(async () => {
    if (!preview) return;
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/v1/exercises/${exerciseId}/import-emham/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ rows: preview.rows, filename }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Fehler' }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const result = await res.json();
      setImportResult({ created: result.created, skipped: result.skipped, duplicates: result.duplicates });
      onImported(result.reports || []);
      setStep('done');
    } catch (err: any) {
      setError(err.message || 'Import fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  }, [exerciseId, preview, filename, onImported]);

  const importableCount = preview?.rows.filter(r => r.matched_repeater_id && !r.is_duplicate).length ?? 0;
  const duplicateCount = preview?.rows.filter(r => r.is_duplicate).length ?? 0;
  const issueCount = preview?.rows.filter(r => r.issues.length > 0).length ?? 0;

  function formatRapport(row: ParsedRow): string {
    if (!row.readability && !row.strength) return '-';
    return `${row.readability || '?'}/${row.strength || '?'}${row.db_over_s9 || ''}`;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#1e3a5f]">EmHam PDF Import</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">
              {error}
            </div>
          )}

          {step === 'upload' && (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">EmHam Auswertungs-PDF hochladen</p>
              <label className="inline-block cursor-pointer bg-[#1e3a5f] hover:bg-[#2a4f7f] text-white px-6 py-3 rounded-lg font-medium transition-colors">
                {loading ? 'Wird verarbeitet...' : 'PDF auswählen'}
                <input
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  disabled={loading}
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) handleUpload(file);
                  }}
                />
              </label>
              <p className="text-xs text-gray-400 mt-3">Nur .pdf Dateien, max. 10 MB</p>
            </div>
          )}

          {step === 'preview' && preview && (
            <>
              <div className="flex items-center gap-4 mb-4 text-sm flex-wrap">
                <span className="font-medium">{preview.total} Einträge erkannt</span>
                <span className="text-green-700">{importableCount} importierbar</span>
                {duplicateCount > 0 && <span className="text-gray-500">{duplicateCount} Duplikat{duplicateCount > 1 ? 'e' : ''}</span>}
                {issueCount > 0 && <span className="text-amber-600">{issueCount} mit Hinweisen</span>}
              </div>

              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 text-left">
                      <th className="px-2 py-1.5 font-medium">Rufzeichen</th>
                      <th className="px-2 py-1.5 font-medium">Name</th>
                      <th className="px-2 py-1.5 font-medium">QTH</th>
                      <th className="px-2 py-1.5 font-medium">Bez.</th>
                      <th className="px-2 py-1.5 font-medium">Rapport</th>
                      <th className="px-2 py-1.5 font-medium">Umsetzer</th>
                      <th className="px-2 py-1.5 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row, i) => (
                      <tr key={i} className={`border-t ${row.is_duplicate ? 'bg-gray-50 opacity-60' : row.issues.length > 0 ? 'bg-amber-50' : ''} ${!row.matched_repeater_id ? 'opacity-50' : ''}`}>
                        <td className="px-2 py-1 font-mono">
                          {row.callsign}{row.suffix ? ` ${row.suffix}` : ''}
                        </td>
                        <td className="px-2 py-1">{row.name || '-'}</td>
                        <td className="px-2 py-1">{row.qth || '-'}</td>
                        <td className="px-2 py-1 font-mono">{row.bezirk_code || '-'}</td>
                        <td className="px-2 py-1 font-mono">{formatRapport(row)}</td>
                        <td className="px-2 py-1">
                          {row.matched_repeater_id
                            ? <span className="text-green-700">{row.repeater_name || 'OK'}</span>
                            : <span className="text-red-600">{row.repeater_name || '?'}</span>
                          }
                        </td>
                        <td className="px-2 py-1">
                          {row.is_duplicate
                            ? <span className="text-gray-500">Duplikat</span>
                            : row.issues.length > 0
                            ? <span className="text-amber-600" title={row.issues.join(', ')}>{row.issues.length} Hinweis{row.issues.length > 1 ? 'e' : ''}</span>
                            : <span className="text-green-600">OK</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {step === 'done' && importResult && (
            <div className="text-center py-8">
              <div className="text-green-600 text-4xl mb-3">&#10003;</div>
              <p className="text-lg font-medium text-gray-800 mb-2">Import abgeschlossen</p>
              <p className="text-sm text-gray-600">
                {importResult.created} Rapporte importiert
                {importResult.duplicates > 0 && <>, {importResult.duplicates} Duplikat{importResult.duplicates > 1 ? 'e' : ''} übersprungen</>}
                {importResult.skipped > 0 && <>, {importResult.skipped} ohne Umsetzer übersprungen</>}
              </p>
            </div>
          )}
        </div>

        <div className="p-4 border-t flex justify-end gap-3">
          {step === 'preview' && (
            <>
              <button
                onClick={() => { setStep('upload'); setPreview(null); setError(null); }}
                disabled={loading}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                Zurück
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading || importableCount === 0}
                className="px-4 py-2 text-sm text-white bg-[#1e3a5f] hover:bg-[#2a4f7f] rounded-lg font-medium disabled:opacity-50"
              >
                {loading ? 'Importieren...' : `${importableCount} Rapporte importieren`}
              </button>
            </>
          )}
          {step === 'done' && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-white bg-[#1e3a5f] hover:bg-[#2a4f7f] rounded-lg font-medium"
            >
              Schließen
            </button>
          )}
          {step === 'upload' && (
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
            >
              Abbrechen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
