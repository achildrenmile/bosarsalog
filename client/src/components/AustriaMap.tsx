import { useState } from 'react';

interface BlData {
  code: string;
  participants: number;
  reports: number;
}

interface Props {
  data: BlData[];
}

const BL_NAMES: Record<string, string> = {
  OE1: 'Wien',
  OE2: 'Salzburg',
  OE3: 'Niederösterreich',
  OE4: 'Burgenland',
  OE5: 'Oberösterreich',
  OE6: 'Steiermark',
  OE7: 'Tirol',
  OE8: 'Kärnten',
  OE9: 'Vorarlberg',
};

// Simplified SVG paths for Austrian Bundesländer
// Positioned within an 800x500 viewBox
const BL_PATHS: Record<string, { d: string; labelX: number; labelY: number }> = {
  OE9: {
    // Vorarlberg — far west, small
    d: 'M32,195 L45,170 L55,155 L68,148 L78,155 L82,172 L85,190 L82,210 L78,228 L70,240 L58,248 L45,242 L35,230 L30,215 Z',
    labelX: 57,
    labelY: 200,
  },
  OE7: {
    // Tirol — wide band across west
    d: 'M85,190 L82,172 L78,155 L88,140 L105,130 L125,125 L145,120 L165,118 L185,122 L200,128 L220,135 L240,140 L255,148 L270,155 L280,165 L285,175 L290,188 L295,200 L288,215 L275,228 L260,235 L245,230 L230,222 L215,218 L200,222 L185,228 L170,232 L155,235 L140,230 L125,222 L110,225 L95,230 L82,228 L78,228 L82,210 Z',
    labelX: 185,
    labelY: 182,
  },
  OE2: {
    // Salzburg — between Tirol and OÖ
    d: 'M290,188 L295,200 L288,215 L275,228 L260,235 L265,252 L275,268 L285,278 L295,285 L310,288 L325,282 L340,272 L350,258 L355,242 L358,225 L355,208 L348,195 L338,185 L325,178 L310,175 L298,178 Z',
    labelX: 315,
    labelY: 232,
  },
  OE5: {
    // Oberösterreich — north-central
    d: 'M310,175 L325,178 L338,185 L348,195 L355,208 L358,225 L368,218 L382,212 L398,208 L415,205 L432,202 L448,198 L462,195 L475,192 L488,188 L495,178 L498,165 L495,150 L488,138 L478,128 L465,120 L450,115 L435,112 L418,110 L400,112 L385,118 L370,125 L355,135 L340,145 L325,155 L315,165 Z',
    labelX: 420,
    labelY: 160,
  },
  OE3: {
    // Niederösterreich — large, northeast, wraps around Wien
    d: 'M488,188 L495,178 L498,165 L495,150 L488,138 L498,128 L512,118 L528,108 L545,100 L565,95 L585,92 L605,90 L625,92 L645,98 L660,108 L672,120 L680,135 L685,152 L682,170 L675,185 L665,198 L650,208 L635,215 L618,220 L600,225 L585,228 L570,230 L558,235 L548,242 L538,250 L525,255 L510,258 L498,255 L488,248 L478,238 L470,225 L465,212 L462,200 Z',
    labelX: 580,
    labelY: 155,
  },
  OE1: {
    // Wien — small, inside NÖ
    d: 'M598,188 L608,182 L618,180 L628,182 L635,188 L638,198 L635,208 L628,215 L618,218 L608,215 L600,208 L598,198 Z',
    labelX: 618,
    labelY: 200,
  },
  OE4: {
    // Burgenland — thin strip east
    d: 'M638,198 L635,208 L635,215 L640,228 L648,242 L655,258 L660,275 L662,292 L660,310 L655,328 L648,342 L638,355 L628,365 L618,370 L608,365 L602,355 L600,342 L598,325 L600,310 L605,295 L610,280 L615,265 L618,250 L620,238 L625,228 L630,218 L635,208 Z',
    labelX: 635,
    labelY: 295,
  },
  OE6: {
    // Steiermark — large, south-central
    d: 'M358,225 L355,242 L350,258 L355,275 L365,290 L378,302 L392,310 L408,315 L425,318 L442,320 L458,322 L475,325 L490,328 L505,330 L520,328 L535,322 L548,315 L558,305 L565,292 L568,278 L565,262 L558,248 L548,242 L538,250 L525,255 L510,258 L498,255 L488,248 L478,238 L470,225 L465,212 L462,200 L448,198 L432,202 L415,205 L398,208 L382,212 L368,218 Z',
    labelX: 465,
    labelY: 275,
  },
  OE8: {
    // Kärnten — south, below Salzburg/Steiermark
    d: 'M245,230 L260,235 L265,252 L275,268 L285,278 L295,285 L310,288 L325,282 L340,272 L350,258 L355,275 L365,290 L378,302 L392,310 L408,315 L415,325 L410,340 L400,352 L385,360 L368,365 L350,368 L332,365 L315,358 L298,348 L282,338 L268,325 L255,310 L245,295 L238,278 L235,260 L238,245 Z',
    labelX: 328,
    labelY: 325,
  },
};

function getColor(value: number, max: number): string {
  if (max === 0) return '#f3f4f6';
  if (value === 0) return '#f3f4f6';
  // Interpolate between light (#c2d5ec) and dark (#1e3a5f)
  const t = value / max;
  const r = Math.round(194 + (30 - 194) * t);
  const g = Math.round(213 + (58 - 213) * t);
  const b = Math.round(236 + (95 - 236) * t);
  return `rgb(${r},${g},${b})`;
}

export default function AustriaMap({ data }: Props) {
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    code: string;
    name: string;
    participants: number;
    reports: number;
  } | null>(null);

  const dataMap = new Map(data.map((d) => [d.code, d]));
  const maxParticipants = Math.max(...data.map((d) => d.participants), 1);

  return (
    <div className="relative">
      <svg
        viewBox="15 75 700 310"
        className="w-full h-auto"
        role="img"
        aria-label="Karte von Österreich mit Teilnehmern nach Bundesland"
      >
        {Object.entries(BL_PATHS).map(([code, { d, labelX, labelY }]) => {
          const bl = dataMap.get(code);
          const participants = bl?.participants ?? 0;
          const reports = bl?.reports ?? 0;
          const fill = getColor(participants, maxParticipants);
          const textColor = participants / maxParticipants > 0.5 ? '#ffffff' : '#1e3a5f';

          return (
            <g
              key={code}
              onMouseEnter={(e) => {
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
                  name: BL_NAMES[code] || code,
                  participants,
                  reports,
                });
              }}
              onMouseLeave={() => setTooltip(null)}
              className="cursor-pointer"
            >
              <path
                d={d}
                fill={fill}
                stroke="#ffffff"
                strokeWidth="2"
                className="transition-opacity hover:opacity-80"
              />
              <text
                x={labelX}
                y={labelY - 6}
                textAnchor="middle"
                fontSize="11"
                fontWeight="bold"
                fill={textColor}
                pointerEvents="none"
              >
                {code}
              </text>
              <text
                x={labelX}
                y={labelY + 8}
                textAnchor="middle"
                fontSize="10"
                fill={textColor}
                pointerEvents="none"
              >
                {participants}
              </text>
            </g>
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
            background: 'linear-gradient(to right, #c2d5ec, #1e3a5f)',
          }}
        />
        <span>{maxParticipants}</span>
        <span className="ml-1 text-gray-400">Teilnehmer</span>
      </div>
    </div>
  );
}
