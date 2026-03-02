import { useState } from 'react';
import { BEZIRK_PATHS, BL_BORDER_PATHS } from '../data/bezirkPaths';

interface BezirkData {
  bezirk_code: string;
  participants: number;
  reports: number;
}

interface Props {
  data: BezirkData[];
}

// BL_BORDER_PATHS imported from generated data (same projection as BEZIRK_PATHS)

const BL_NAMES: Record<string, string> = {
  '01': 'Wien', '02': 'Salzburg', '03': 'Niederösterreich', '04': 'Burgenland',
  '05': 'Oberösterreich', '06': 'Steiermark', '07': 'Tirol', '08': 'Kärnten',
  '09': 'Vorarlberg',
};

function getHeatColor(value: number, max: number): string {
  if (max === 0 || value === 0) return '#f3f4f6';
  const t = Math.min(value / max, 1);
  // Green (120) → Yellow (60) → Red (0) via HSL
  const h = 120 * (1 - t);
  const s = 70 + 15 * t; // 70-85%
  const l = 45 + 10 * (1 - t); // 45-55%
  return `hsl(${h}, ${s}%, ${l}%)`;
}

export default function AustriaBezirkMap({ data }: Props) {
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    code: string;
    name: string;
    bundesland: string;
    participants: number;
    reports: number;
  } | null>(null);

  const dataMap = new Map(data.map((d) => [d.bezirk_code, d]));
  const maxParticipants = Math.max(...data.map((d) => d.participants), 1);

  const showTooltip = (
    e: React.MouseEvent,
    code: string,
    labelX: number,
    labelY: number,
    participants: number,
    reports: number,
    name: string,
    bundesland: string,
  ) => {
    const svg = e.currentTarget.closest('svg');
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const pt = svg.createSVGPoint();
    pt.x = labelX;
    pt.y = labelY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const screenPt = pt.matrixTransform(ctm);
    setTooltip({
      x: screenPt.x - rect.left,
      y: screenPt.y - rect.top - 10,
      code,
      name,
      bundesland,
      participants,
      reports,
    });
  };

  return (
    <div className="relative">
      <svg
        viewBox="-5 -45 635 460"
        className="w-full"
        style={{ maxHeight: '420px' }}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Bezirks-Heatmap von Österreich"
      >
        {/* Bezirk polygons */}
        {Object.entries(BEZIRK_PATHS).map(([code, { d, labelX, labelY, name, bundesland_code }]) => {
          const bz = dataMap.get(code);
          const participants = bz?.participants ?? 0;
          const reports = bz?.reports ?? 0;
          const fill = getHeatColor(participants, maxParticipants);
          const blName = BL_NAMES[bundesland_code] || '';

          return (
            <path
              key={code}
              d={d}
              fill={fill}
              stroke="#ffffff"
              strokeWidth="0.5"
              className="transition-opacity hover:opacity-75 cursor-pointer"
              onMouseEnter={(e) => showTooltip(e, code, labelX, labelY, participants, reports, name, blName)}
              onMouseLeave={() => setTooltip(null)}
            />
          );
        })}

        {/* Bundesland borders overlay */}
        {Object.values(BL_BORDER_PATHS).map((d, i) => (
          <path
            key={`bl-${i}`}
            d={d}
            fill="none"
            stroke="#1e3a5f"
            strokeWidth="1.5"
            pointerEvents="none"
          />
        ))}

        {/* Labels for Bezirke with data */}
        {Object.entries(BEZIRK_PATHS).map(([code, { labelX, labelY }]) => {
          const bz = dataMap.get(code);
          if (!bz || bz.participants === 0) return null;
          return (
            <text
              key={`label-${code}`}
              x={labelX}
              y={labelY}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="6"
              fontWeight="bold"
              fill="#1e3a5f"
              pointerEvents="none"
              stroke="#ffffff"
              strokeWidth="2"
              paintOrder="stroke"
            >
              {code}
            </text>
          );
        })}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute bg-gray-900 text-white text-xs rounded px-2 py-1.5 pointer-events-none shadow-lg z-10 whitespace-nowrap"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="font-bold">{tooltip.code} — {tooltip.name}</div>
          <div className="text-gray-300">{tooltip.bundesland}</div>
          <div>Teilnehmer: {tooltip.participants}</div>
          <div>Rapporte: {tooltip.reports}</div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center justify-center gap-2 mt-2 text-xs text-gray-500">
        <span>0</span>
        <div
          className="h-3 w-32 rounded"
          style={{
            background: 'linear-gradient(to right, hsl(120,70%,55%), hsl(60,78%,50%), hsl(0,85%,45%))',
          }}
        />
        <span>{maxParticipants}</span>
        <span className="ml-1 text-gray-400">Teilnehmer</span>
      </div>
    </div>
  );
}
