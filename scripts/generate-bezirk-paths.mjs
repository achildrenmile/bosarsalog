#!/usr/bin/env node
/**
 * One-time script: download Austrian Bezirke GeoJSON and convert to SVG paths.
 * Output: client/src/data/bezirkPaths.ts
 *
 * Projection calibrated to match existing AustriaMap.tsx BL_PATHS coordinate system.
 * Source: github.com/ginseng666/GeoJSON-TopoJSON-Austria (CC BY-SA 3.0)
 */

import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// GeoJSON URLs — 99.5% simplified
const BEZIRKE_URL = 'https://raw.githubusercontent.com/ginseng666/GeoJSON-TopoJSON-Austria/master/2021/simplified-99.5/bezirke_995_geo.json';
const LAENDER_URL = 'https://raw.githubusercontent.com/ginseng666/GeoJSON-TopoJSON-Austria/master/2021/simplified-99.5/laender_995_geo.json';

// Mapping from Gemeindekennzahl (iso field) to KFZ Bezirk code
// The GeoJSON uses 3-digit district codes (iso field or similar)
const GKZ_TO_KFZ = {
  // Wien (900 = single district for all of Wien)
  '900': 'W', '901': 'W', '902': 'W', '903': 'W', '904': 'W', '905': 'W',
  '906': 'W', '907': 'W', '908': 'W', '909': 'W', '910': 'W', '911': 'W',
  '912': 'W', '913': 'W', '914': 'W', '915': 'W', '916': 'W', '917': 'W',
  '918': 'W', '919': 'W', '920': 'W', '921': 'W', '922': 'W', '923': 'W',
  // Burgenland
  '101': 'EC', // Eisenstadt (Stadt)
  '102': 'RU', // Rust (Stadt)
  '103': 'EU', // Eisenstadt-Umgebung
  '104': 'GS', // Güssing
  '105': 'JE', // Jennersdorf
  '106': 'MA', // Mattersburg
  '107': 'ND', // Neusiedl am See
  '108': 'OP', // Oberpullendorf
  '109': 'OW', // Oberwart
  // Kärnten
  '201': 'KC', // Klagenfurt Stadt
  '202': 'VI', // Villach Stadt
  '203': 'HE', // Hermagor
  '204': 'KL', // Klagenfurt-Land
  '205': 'SV', // Sankt Veit an der Glan
  '206': 'SP', // Spittal an der Drau
  '207': 'VL', // Villach-Land
  '208': 'VK', // Völkermarkt
  '209': 'WO', // Wolfsberg
  '210': 'FE', // Feldkirchen
  // Niederösterreich
  '301': 'KS', // Krems an der Donau (Stadt)
  '302': 'PC', // St. Pölten (Stadt)
  '303': 'WY', // Waidhofen an der Ybbs (Stadt)
  '304': 'WN', // Wiener Neustadt (Stadt)
  '305': 'AM', // Amstetten
  '306': 'BN', // Baden
  '307': 'BL', // Bruck an der Leitha
  '308': 'GF', // Gänserndorf
  '309': 'GD', // Gmünd
  '310': 'HL', // Hollabrunn
  '311': 'HO', // Horn
  '312': 'KO', // Korneuburg
  '313': 'KR', // Krems (Land)
  '314': 'LF', // Lilienfeld
  '315': 'ME', // Melk
  '316': 'MI', // Mistelbach
  '317': 'MD', // Mödling
  '318': 'NK', // Neunkirchen
  '319': 'PL', // St. Pölten (Land)
  '320': 'SB', // Scheibbs
  '321': 'TU', // Tulln
  '322': 'WT', // Waidhofen an der Thaya
  '323': 'WB', // Wiener Neustadt (Land)
  '325': 'ZT', // Zwettl
  // Oberösterreich
  '401': 'LC', // Linz (Stadt)
  '402': 'SE', // Steyr (Stadt)
  '403': 'WE', // Wels (Stadt)
  '404': 'BR', // Braunau am Inn
  '405': 'EF', // Eferding
  '406': 'FR', // Freistadt
  '407': 'GM', // Gmunden
  '408': 'GR', // Grieskirchen
  '409': 'KI', // Kirchdorf an der Krems
  '410': 'LL', // Linz-Land
  '411': 'PE', // Perg
  '412': 'RI', // Ried im Innkreis
  '413': 'RO', // Rohrbach
  '414': 'SD', // Schärding
  '415': 'SR', // Steyr-Land
  '416': 'UU', // Urfahr-Umgebung
  '417': 'VB', // Vöcklabruck
  '418': 'WL', // Wels-Land
  // Salzburg
  '501': 'SC', // Salzburg (Stadt)
  '502': 'HA', // Hallein
  '503': 'SL', // Salzburg-Umgebung
  '504': 'JO', // St. Johann im Pongau
  '505': 'TA', // Tamsweg
  '506': 'ZE', // Zell am See
  // Steiermark
  '601': 'GC', // Graz (Stadt)
  '603': 'DL', // Deutschlandsberg
  '606': 'GU', // Graz-Umgebung
  '610': 'LB', // Leibnitz
  '611': 'LE', // Leoben
  '612': 'LI', // Liezen
  '614': 'MU', // Murau
  '616': 'VO', // Voitsberg
  '617': 'WZ', // Weiz
  '620': 'MT', // Murtal
  '621': 'BM', // Bruck-Mürzzuschlag
  '622': 'HF', // Hartberg-Fürstenfeld
  '623': 'SO', // Südoststeiermark
  // Tirol
  '701': 'IC', // Innsbruck (Stadt)
  '702': 'IM', // Imst
  '703': 'IL', // Innsbruck-Land
  '704': 'KB', // Kitzbühel
  '705': 'KU', // Kufstein
  '706': 'LA', // Landeck
  '707': 'LZ', // Lienz
  '708': 'RE', // Reutte
  '709': 'SZ', // Schwaz
  // Vorarlberg
  '801': 'BZ', // Bludenz
  '802': 'BC', // Bregenz
  '803': 'DO', // Dornbirn
  '804': 'FK', // Feldkirch
};

// Bezirk metadata from seed.ts
const BEZIRK_META = {
  'W': { name: 'Wien', bundesland_code: '01' },
  'HA': { name: 'Hallein', bundesland_code: '02' },
  'JO': { name: 'St. Johann im Pongau', bundesland_code: '02' },
  'SC': { name: 'Salzburg Stadt', bundesland_code: '02' },
  'SL': { name: 'Salzburg-Umgebung', bundesland_code: '02' },
  'TA': { name: 'Tamsweg', bundesland_code: '02' },
  'ZE': { name: 'Zell am See', bundesland_code: '02' },
  'AM': { name: 'Amstetten', bundesland_code: '03' },
  'BN': { name: 'Baden', bundesland_code: '03' },
  'BL': { name: 'Bruck an der Leitha', bundesland_code: '03' },
  'GF': { name: 'Gänserndorf', bundesland_code: '03' },
  'GD': { name: 'Gmünd', bundesland_code: '03' },
  'HL': { name: 'Hollabrunn', bundesland_code: '03' },
  'HO': { name: 'Horn', bundesland_code: '03' },
  'KO': { name: 'Korneuburg', bundesland_code: '03' },
  'KS': { name: 'Krems Stadt', bundesland_code: '03' },
  'KR': { name: 'Krems-Land', bundesland_code: '03' },
  'LF': { name: 'Lilienfeld', bundesland_code: '03' },
  'ME': { name: 'Melk', bundesland_code: '03' },
  'MI': { name: 'Mistelbach', bundesland_code: '03' },
  'MD': { name: 'Mödling', bundesland_code: '03' },
  'NK': { name: 'Neunkirchen', bundesland_code: '03' },
  'PC': { name: 'St. Pölten', bundesland_code: '03' },
  'PL': { name: 'St. Pölten-Land', bundesland_code: '03' },
  'SB': { name: 'Scheibbs', bundesland_code: '03' },
  'TU': { name: 'Tulln', bundesland_code: '03' },
  'WY': { name: 'Waidhofen an der Ybbs', bundesland_code: '03' },
  'WT': { name: 'Waidhofen an der Thaya', bundesland_code: '03' },
  'WN': { name: 'Wiener Neustadt', bundesland_code: '03' },
  'WB': { name: 'Wiener Neustadt-Land', bundesland_code: '03' },
  'ZT': { name: 'Zwettl', bundesland_code: '03' },
  'EC': { name: 'Eisenstadt', bundesland_code: '04' },
  'EU': { name: 'Eisenstadt-Umgebung', bundesland_code: '04' },
  'GS': { name: 'Güssing', bundesland_code: '04' },
  'JE': { name: 'Jennersdorf', bundesland_code: '04' },
  'MA': { name: 'Mattersburg', bundesland_code: '04' },
  'ND': { name: 'Neusiedl am See', bundesland_code: '04' },
  'OP': { name: 'Oberpullendorf', bundesland_code: '04' },
  'OW': { name: 'Oberwart', bundesland_code: '04' },
  'RU': { name: 'Rust', bundesland_code: '04' },
  'BR': { name: 'Braunau am Inn', bundesland_code: '05' },
  'EF': { name: 'Eferding', bundesland_code: '05' },
  'FR': { name: 'Freistadt', bundesland_code: '05' },
  'GM': { name: 'Gmunden', bundesland_code: '05' },
  'GR': { name: 'Grieskirchen', bundesland_code: '05' },
  'KI': { name: 'Kirchdorf an der Krems', bundesland_code: '05' },
  'LC': { name: 'Linz Stadt', bundesland_code: '05' },
  'LL': { name: 'Linz-Land', bundesland_code: '05' },
  'PE': { name: 'Perg', bundesland_code: '05' },
  'RI': { name: 'Ried im Innkreis', bundesland_code: '05' },
  'RO': { name: 'Rohrbach', bundesland_code: '05' },
  'SD': { name: 'Schärding', bundesland_code: '05' },
  'SR': { name: 'Steyr-Land', bundesland_code: '05' },
  'SE': { name: 'Steyr Stadt', bundesland_code: '05' },
  'UU': { name: 'Urfahr-Umgebung', bundesland_code: '05' },
  'VB': { name: 'Vöcklabruck', bundesland_code: '05' },
  'WE': { name: 'Wels', bundesland_code: '05' },
  'WL': { name: 'Wels-Land', bundesland_code: '05' },
  'BM': { name: 'Bruck-Mürzzuschlag', bundesland_code: '06' },
  'DL': { name: 'Deutschlandsberg', bundesland_code: '06' },
  'GC': { name: 'Graz Stadt', bundesland_code: '06' },
  'GU': { name: 'Graz-Umgebung', bundesland_code: '06' },
  'HF': { name: 'Hartberg-Fürstenfeld', bundesland_code: '06' },
  'LB': { name: 'Leibnitz', bundesland_code: '06' },
  'LE': { name: 'Leoben', bundesland_code: '06' },
  'LI': { name: 'Liezen', bundesland_code: '06' },
  'MU': { name: 'Murau', bundesland_code: '06' },
  'MT': { name: 'Murtal', bundesland_code: '06' },
  'SO': { name: 'Südoststeiermark', bundesland_code: '06' },
  'VO': { name: 'Voitsberg', bundesland_code: '06' },
  'WZ': { name: 'Weiz', bundesland_code: '06' },
  'IC': { name: 'Innsbruck Stadt', bundesland_code: '07' },
  'IM': { name: 'Imst', bundesland_code: '07' },
  'IL': { name: 'Innsbruck-Land', bundesland_code: '07' },
  'KB': { name: 'Kitzbühel', bundesland_code: '07' },
  'KU': { name: 'Kufstein', bundesland_code: '07' },
  'LA': { name: 'Landeck', bundesland_code: '07' },
  'LZ': { name: 'Lienz', bundesland_code: '07' },
  'RE': { name: 'Reutte', bundesland_code: '07' },
  'SZ': { name: 'Schwaz', bundesland_code: '07' },
  'FE': { name: 'Feldkirchen', bundesland_code: '08' },
  'HE': { name: 'Hermagor', bundesland_code: '08' },
  'KC': { name: 'Klagenfurt Stadt', bundesland_code: '08' },
  'KL': { name: 'Klagenfurt-Land', bundesland_code: '08' },
  'SV': { name: 'Sankt Veit an der Glan', bundesland_code: '08' },
  'SP': { name: 'Spittal an der Drau', bundesland_code: '08' },
  'VI': { name: 'Villach Stadt', bundesland_code: '08' },
  'VL': { name: 'Villach-Land', bundesland_code: '08' },
  'VK': { name: 'Völkermarkt', bundesland_code: '08' },
  'WO': { name: 'Wolfsberg', bundesland_code: '08' },
  'BZ': { name: 'Bludenz', bundesland_code: '09' },
  'BC': { name: 'Bregenz', bundesland_code: '09' },
  'DO': { name: 'Dornbirn', bundesland_code: '09' },
  'FK': { name: 'Feldkirch', bundesland_code: '09' },
};

// ─── Linear Projection (matching existing AustriaMap BL_PATHS) ───
// The existing BL_PATHS from MapSVG use a simple linear (equirectangular)
// projection, NOT Mercator. Analysis of the existing map shows:
//   - X scale: 78.55 px/degree
//   - Y scale: ~118 px/degree (linear)
//   - Y/X ratio: ~1.50 (consistent with equirectangular at ~48°N)
//
// Calibration anchor: Wien center 16.37°E, 48.21°N → SVG (550, 97)
//
// X: x = lon * SX + OX
//   SX = 78.55
//   OX = 550 - 16.37 * 78.55 = -735.86
//
// Y: y = lat * SY + OY  (linear, negative because SVG Y increases downward)
//   SY = -SX * 1.50 = -117.83  (Y/X ratio from existing map analysis)
//   OY = 97 - 48.21 * (-117.83) = 97 + 5680.0 = 5777.0

const SX = 78.55;
const OX = -735.86;
const SY = -117.83;
const OY = 5777.0;

function projectLon(lon) { return lon * SX + OX; }
function projectLat(lat) { return lat * SY + OY; }

function coordsToSvgPath(rings) {
  return rings.map((ring, ri) => {
    const parts = ring.map(([lon, lat], i) => {
      const x = projectLon(lon);
      const y = projectLat(lat);
      const xr = Math.round(x * 100) / 100;
      const yr = Math.round(y * 100) / 100;
      return `${i === 0 ? 'M' : 'L'}${xr},${yr}`;
    });
    return parts.join('') + 'Z';
  }).join('');
}

function getCentroid(rings) {
  // Use first (outer) ring
  const ring = rings[0];
  let cx = 0, cy = 0;
  for (const [lon, lat] of ring) {
    cx += projectLon(lon);
    cy += projectLat(lat);
  }
  return { x: Math.round(cx / ring.length * 100) / 100, y: Math.round(cy / ring.length * 100) / 100 };
}

// Bundesland iso code → DB code
const BL_ISO_TO_DB = {
  '1': '04', // Burgenland
  '2': '08', // Kärnten
  '3': '03', // Niederösterreich
  '4': '05', // Oberösterreich
  '5': '02', // Salzburg
  '6': '06', // Steiermark
  '7': '07', // Tirol
  '8': '09', // Vorarlberg
  '9': '01', // Wien
};

async function main() {
  console.log('Fetching Bezirke GeoJSON...');
  const response = await fetch(BEZIRKE_URL);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const geojson = await response.json();
  console.log(`Got ${geojson.features.length} bezirk features`);

  console.log('Fetching Bundesländer GeoJSON...');
  const blResponse = await fetch(LAENDER_URL);
  if (!blResponse.ok) throw new Error(`HTTP ${blResponse.status}`);
  const blGeojson = await blResponse.json();
  console.log(`Got ${blGeojson.features.length} bundesland features`);

  // Group features by KFZ code (Wien 23 sub-districts → merge)
  const byKfz = {};

  for (const feature of geojson.features) {
    const props = feature.properties;
    // The GeoJSON uses 'iso' or 'id' for the district code
    const gkz = String(props.iso || props.id || '');
    const kfz = GKZ_TO_KFZ[gkz];
    if (!kfz) {
      console.warn(`  Unknown GKZ: ${gkz} (${props.name})`);
      continue;
    }
    if (!byKfz[kfz]) byKfz[kfz] = [];

    const geom = feature.geometry;
    if (geom.type === 'Polygon') {
      byKfz[kfz].push(geom.coordinates);
    } else if (geom.type === 'MultiPolygon') {
      for (const polygon of geom.coordinates) {
        byKfz[kfz].push(polygon);
      }
    }
  }

  console.log(`Mapped to ${Object.keys(byKfz).length} Bezirke`);

  // Build output
  const entries = {};
  for (const [kfz, polygons] of Object.entries(byKfz)) {
    const meta = BEZIRK_META[kfz];
    if (!meta) {
      console.warn(`  No metadata for KFZ: ${kfz}`);
      continue;
    }

    // Merge all rings into a single SVG path
    const allRings = [];
    const allOuterRings = [];
    for (const polygon of polygons) {
      for (const ring of polygon) {
        allRings.push(ring);
      }
      allOuterRings.push(polygon[0]); // outer ring for centroid
    }

    const d = coordsToSvgPath(allRings);

    // Centroid from all outer rings combined
    let cx = 0, cy = 0, n = 0;
    for (const ring of allOuterRings) {
      for (const [lon, lat] of ring) {
        cx += projectLon(lon);
        cy += projectLat(lat);
        n++;
      }
    }
    cx = Math.round(cx / n * 100) / 100;
    cy = Math.round(cy / n * 100) / 100;

    entries[kfz] = {
      d,
      labelX: cx,
      labelY: cy,
      name: meta.name,
      bundesland_code: meta.bundesland_code,
    };
  }

  // Generate TypeScript output
  const lines = [
    '// Auto-generated by scripts/generate-bezirk-paths.mjs',
    '// Source: github.com/ginseng666/GeoJSON-TopoJSON-Austria (CC BY-SA 3.0)',
    '// Do not edit manually.',
    '',
    'export const BEZIRK_PATHS: Record<string, {',
    '  d: string; labelX: number; labelY: number;',
    '  name: string; bundesland_code: string;',
    '}> = {',
  ];

  const sortedKeys = Object.keys(entries).sort((a, b) => {
    const ba = entries[a].bundesland_code;
    const bb = entries[b].bundesland_code;
    if (ba !== bb) return ba.localeCompare(bb);
    return a.localeCompare(b);
  });

  for (const kfz of sortedKeys) {
    const e = entries[kfz];
    lines.push(`  '${kfz}': {`);
    lines.push(`    d: '${e.d}',`);
    lines.push(`    labelX: ${e.labelX}, labelY: ${e.labelY},`);
    lines.push(`    name: '${e.name.replace(/'/g, "\\'")}', bundesland_code: '${e.bundesland_code}',`);
    lines.push(`  },`);
  }

  lines.push('};');
  lines.push('');

  // ─── Bundesländer borders (same projection) ───
  const blEntries = {};
  for (const feature of blGeojson.features) {
    const props = feature.properties;
    const iso = String(props.iso || props.id || '');
    const dbCode = BL_ISO_TO_DB[iso];
    if (!dbCode) {
      console.warn(`  Unknown BL iso: ${iso} (${props.name})`);
      continue;
    }
    const geom = feature.geometry;
    const allRings = [];
    if (geom.type === 'Polygon') {
      for (const ring of geom.coordinates) allRings.push(ring);
    } else if (geom.type === 'MultiPolygon') {
      for (const polygon of geom.coordinates) {
        for (const ring of polygon) allRings.push(ring);
      }
    }
    blEntries[dbCode] = coordsToSvgPath(allRings);
  }

  lines.push('export const BL_BORDER_PATHS: Record<string, string> = {');
  for (const code of Object.keys(blEntries).sort()) {
    lines.push(`  '${code}': '${blEntries[code]}',`);
  }
  lines.push('};');
  lines.push('');

  const outPath = resolve(__dirname, '../client/src/data/bezirkPaths.ts');
  writeFileSync(outPath, lines.join('\n'));
  console.log(`Written ${sortedKeys.length} Bezirke + ${Object.keys(blEntries).length} BL borders to ${outPath}`);
  console.log(`File size: ${(lines.join('\n').length / 1024).toFixed(1)} KB`);
}

main().catch(console.error);
