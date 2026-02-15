import { useState, useRef, useEffect } from 'react';
import { apiFetch } from '../services/api';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSelect: (operator: any) => void;
  autoFocus?: boolean;
  className?: string;
}

export default function CallsignInput({ value, onChange, onSelect, autoFocus, className }: Props) {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (autoFocus && inputRef.current) inputRef.current.focus();
  }, [autoFocus]);

  const search = (q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) { setSuggestions([]); setShowSuggestions(false); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await apiFetch(`/api/v1/operators?q=${encodeURIComponent(q)}`);
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
        setSelectedIdx(-1);
      } catch {}
    }, 150);
  };

  const handleChange = (val: string) => {
    const upper = val.toUpperCase();
    onChange(upper);
    search(upper);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(prev => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter' && selectedIdx >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[selectedIdx]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
    // Keyboard shortcuts
    if (e.altKey && e.key >= '1' && e.key <= '9') {
      e.preventDefault();
      onChange(value + `5/${e.key}`);
    }
    if (e.ctrlKey && e.key >= '1' && e.key <= '9') {
      e.preventDefault();
      onChange(`OE${e.key}`);
    }
  };

  const selectSuggestion = (op: any) => {
    onChange(op.callsign);
    onSelect(op);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={e => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
        onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
        className={`border border-gray-300 rounded px-2 py-1 font-mono uppercase text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 ${className || 'w-32'}`}
        placeholder="Rufzeichen"
      />
      {showSuggestions && (
        <div className="absolute z-20 top-full left-0 mt-1 bg-white border rounded shadow-lg max-h-48 overflow-auto w-64">
          {suggestions.map((op, i) => (
            <div
              key={op.id}
              onMouseDown={() => selectSuggestion(op)}
              className={`px-3 py-1.5 cursor-pointer text-sm ${i === selectedIdx ? 'bg-amber-100' : 'hover:bg-gray-100'}`}
            >
              <span className="font-mono font-bold">{op.callsign}</span>
              {op.name && <span className="ml-2 text-gray-500">{op.name}</span>}
              {op.bezirk_code && <span className="ml-1 text-xs bg-gray-200 rounded px-1">{op.bezirk_code}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
