import { initDb } from './database.js';
import { runMigrations } from './schema.js';
import bcrypt from 'bcryptjs';

const db = initDb();
runMigrations(db);

console.log('Seeding database...');

// Clear existing data
db.exec('DELETE FROM signal_reports');
db.exec('DELETE FROM exercise_attendance');
db.exec('DELETE FROM exercise_repeaters');
db.exec('DELETE FROM exercises');
db.exec('DELETE FROM einstiegspunkte');
db.exec('DELETE FROM repeaters');
db.exec('DELETE FROM operators');
db.exec('DELETE FROM bezirke');
db.exec('DELETE FROM bundeslaender');
db.exec('DELETE FROM admins');

// ─── Bundesländer ───
const insertBl = db.prepare('INSERT INTO bundeslaender (code, name, sort_order, is_international) VALUES (?, ?, ?, ?)');
const bundeslaender = [
  ['01', 'Wien', 1, 0],
  ['02', 'Salzburg', 2, 0],
  ['03', 'Niederösterreich', 3, 0],
  ['04', 'Burgenland', 4, 0],
  ['05', 'Oberösterreich', 5, 0],
  ['06', 'Steiermark', 6, 0],
  ['07', 'Tirol', 7, 0],
  ['08', 'Kärnten', 8, 0],
  ['09', 'Vorarlberg', 9, 0],
  ['10', 'Slowenien', 10, 1],
  ['11', 'Tschechien', 11, 1],
  ['12', 'Deutschland', 12, 1],
  ['13', 'Italien', 13, 1],
  ['14', 'Slowakei', 14, 1],
  ['15', 'Kroatien', 15, 1],
  ['16', 'Liechtenstein', 16, 1],
  ['17', 'Schweiz', 17, 1],
  ['18', 'Ungarn', 18, 1],
];
const insertBlMany = db.transaction(() => {
  for (const bl of bundeslaender) insertBl.run(...bl);
});
insertBlMany();
console.log(`  ✓ ${bundeslaender.length} Bundesländer`);

// ─── Bezirke ───
const insertBez = db.prepare('INSERT INTO bezirke (code, name, bundesland_code, is_capital) VALUES (?, ?, ?, ?)');
const bezirke = [
  // Wien (01)
  ['W', 'Wien', '01', 1],
  // Salzburg (02)
  ['HA', 'Hallein', '02', 0],
  ['JO', 'St. Johann im Pongau', '02', 0],
  ['SC', 'Salzburg Stadt', '02', 1],
  ['SL', 'Salzburg-Umgebung', '02', 0],
  ['TA', 'Tamsweg', '02', 0],
  ['ZE', 'Zell am See', '02', 0],
  // Niederösterreich (03)
  ['AM', 'Amstetten', '03', 0],
  ['BN', 'Baden', '03', 0],
  ['BL', 'Bruck an der Leitha', '03', 0],
  ['GF', 'Gänserndorf', '03', 0],
  ['GD', 'Gmünd', '03', 0],
  ['HL', 'Hollabrunn', '03', 0],
  ['HO', 'Horn', '03', 0],
  ['KO', 'Korneuburg', '03', 0],
  ['KS', 'Krems Stadt', '03', 1],
  ['KR', 'Krems-Land', '03', 0],
  ['LF', 'Lilienfeld', '03', 0],
  ['ME', 'Melk', '03', 0],
  ['MI', 'Mistelbach', '03', 0],
  ['MD', 'Mödling', '03', 0],
  ['NK', 'Neunkirchen', '03', 0],
  ['PL', 'St. Pölten', '03', 1],
  ['SB', 'Scheibbs', '03', 0],
  ['TU', 'Tulln', '03', 0],
  ['WT', 'Waidhofen an der Thaya', '03', 0],
  ['WN', 'Wiener Neustadt', '03', 0],
  ['WB', 'Wiener Neustadt-Land', '03', 0],
  ['ZT', 'Zwettl', '03', 0],
  // Burgenland (04)
  ['EU', 'Eisenstadt-Umgebung', '04', 0],
  ['GS', 'Güssing', '04', 0],
  ['JE', 'Jennersdorf', '04', 0],
  ['MA', 'Mattersburg', '04', 0],
  ['ND', 'Neusiedl am See', '04', 0],
  ['OP', 'Oberpullendorf', '04', 0],
  ['OW', 'Oberwart', '04', 0],
  // Oberösterreich (05)
  ['BR', 'Braunau am Inn', '05', 0],
  ['EF', 'Eferding', '05', 0],
  ['FR', 'Freistadt', '05', 0],
  ['GM', 'Gmunden', '05', 0],
  ['GR', 'Grieskirchen', '05', 0],
  ['KI', 'Kirchdorf an der Krems', '05', 0],
  ['LL', 'Linz-Land', '05', 0],
  ['PE', 'Perg', '05', 0],
  ['RI', 'Ried im Innkreis', '05', 0],
  ['RO', 'Rohrbach', '05', 0],
  ['SD', 'Schärding', '05', 0],
  ['SR', 'Steyr-Land', '05', 0],
  ['SE', 'Steyr Stadt', '05', 1],
  ['UU', 'Urfahr-Umgebung', '05', 0],
  ['VB', 'Vöcklabruck', '05', 0],
  ['WE', 'Wels', '05', 1],
  ['WL', 'Wels-Land', '05', 0],
  // Steiermark (06)
  ['BM', 'Bruck-Mürzzuschlag', '06', 0],
  ['DL', 'Deutschlandsberg', '06', 0],
  ['GU', 'Graz-Umgebung', '06', 0],
  ['HF', 'Hartberg-Fürstenfeld', '06', 0],
  ['LB', 'Leibnitz', '06', 0],
  ['LE', 'Leoben', '06', 0],
  ['LI', 'Liezen', '06', 0],
  ['MU', 'Murau', '06', 0],
  ['MT', 'Murtal', '06', 0],
  ['SO', 'Südoststeiermark', '06', 0],
  ['VO', 'Voitsberg', '06', 0],
  ['WZ', 'Weiz', '06', 0],
  // Tirol (07)
  ['IM', 'Imst', '07', 0],
  ['IL', 'Innsbruck-Land', '07', 0],
  ['KU', 'Kufstein', '07', 0],
  ['LZ', 'Lienz', '07', 0],
  ['RE', 'Reutte', '07', 0],
  ['SZ', 'Schwaz', '07', 0],
  // Kärnten (08)
  ['FE', 'Feldkirchen', '08', 0],
  ['HE', 'Hermagor', '08', 0],
  ['KC', 'Klagenfurt Stadt', '08', 1],
  ['KL', 'Klagenfurt-Land', '08', 0],
  ['SV', 'Sankt Veit an der Glan', '08', 0],
  ['SP', 'Spittal an der Drau', '08', 0],
  ['VI', 'Villach Stadt', '08', 1],
  ['VL', 'Villach-Land', '08', 0],
  ['VK', 'Völkermarkt', '08', 0],
  ['WO', 'Wolfsberg', '08', 0],
  // Vorarlberg (09)
  ['DO', 'Dornbirn', '09', 0],
  ['FK', 'Feldkirch', '09', 0],
  ['BC', 'Bregenz', '09', 1],
];
const insertBezMany = db.transaction(() => {
  for (const b of bezirke) insertBez.run(...b);
});
insertBezMany();
console.log(`  ✓ ${bezirke.length} Bezirke`);

// ─── Repeaters ───
// Comprehensive Austrian repeater list from OEVSV data, organized by Bundesland
// Format: [short_name, site_name, band, callsign, frequency_mhz, offset_mhz, ctcss_hz, burst_hz, type, is_linked, sort_order, bundesland_code]
const insertRep = db.prepare(`INSERT INTO repeaters (short_name, site_name, band, callsign, frequency_mhz, offset_mhz, ctcss_hz, burst_hz, type, is_linked, sort_order, bundesland_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

let sortIdx = 0;
const repeaters: any[][] = [
  // ─── OE1 Wien ───
  ['Laaerberg 2m', 'Laaerberg Turm', '2m', 'OE1XFW', 145.625, -0.6, null, null, 'repeater', 0, ++sortIdx, '01'],
  ['Laaerberg 70cm', 'Laaerberg Turm', '70cm', 'OE1XFW', 438.650, -7.6, null, null, 'repeater', 0, ++sortIdx, '01'],
  ['Kahlenberg 70cm', 'Kahlenberg', '70cm', 'OE1XUU', 438.950, -7.6, 162.2, null, 'repeater', 0, ++sortIdx, '01'],
  ['Satzberg 70cm', 'Satzberg', '70cm', 'OE1XFU', 439.000, -7.6, 162.2, null, 'repeater', 0, ++sortIdx, '01'],
  ['Bisamberg 70cm', 'Bisamberg', '70cm', 'OE1XAR', 438.500, -7.6, null, null, 'repeater', 0, ++sortIdx, '01'],
  ['AKH 2m', 'AKH Wien', '2m', 'OE1XDS', 145.575, -0.6, null, null, 'repeater', 0, ++sortIdx, '01'],
  ['AKH 70cm', 'AKH Wien', '70cm', 'OE1XDS', 438.525, -7.6, null, null, 'repeater', 0, ++sortIdx, '01'],
  ['AKH 23cm', 'AKH Wien', '23cm', 'OE1XDS', 1298.650, -28, null, null, 'repeater', 0, ++sortIdx, '01'],
  ['Hermannskogel 70cm', 'Hermannskogel', '70cm', 'OE1XAT', 438.475, -7.6, 162.2, null, 'repeater', 1, ++sortIdx, '01'],
  ['Exelberg 2m', 'Exelberg', '2m', 'OE3XQA', 145.750, -0.6, 162.2, null, 'repeater', 0, ++sortIdx, '01'],

  // ─── OE2 Salzburg ───
  ['Gernkogel 2m', 'Gernkogel', '2m', 'OE2XGR', 145.7625, -0.6, 88.5, null, 'repeater', 0, ++sortIdx, '02'],
  ['Gernkogel 70cm', 'Gernkogel', '70cm', 'OE2XGR', 438.525, -7.6, null, null, 'repeater', 0, ++sortIdx, '02'],
  ['Kitzsteinhorn 2m', 'Kitzsteinhorn', '2m', 'OE2XHL', 145.650, -0.6, 88.5, null, 'repeater', 0, ++sortIdx, '02'],
  ['Sonnblick 70cm', 'Hoher Sonnblick', '70cm', 'OE2XSV', 439.0875, -7.6, null, null, 'repeater', 0, ++sortIdx, '02'],
  ['Speiereck 2m', 'Speiereck', '2m', 'OE2XNL', 145.6125, -0.6, null, null, 'repeater', 0, ++sortIdx, '02'],
  ['Speiereck 70cm', 'Speiereck', '70cm', 'OE2XNM', 438.975, -7.6, null, null, 'repeater', 0, ++sortIdx, '02'],
  ['Gaisberg 70cm', 'Gaisberg', '70cm', 'OE2XZR', 438.950, -7.6, 88.5, null, 'repeater', 1, ++sortIdx, '02'],

  // ─── OE3 Niederösterreich ───
  ['Nebelstein 2m', 'Nebelstein', '2m', 'OE3XNR', 145.6375, -0.6, 88.5, null, 'repeater', 0, ++sortIdx, '03'],
  ['Nebelstein 70cm', 'Nebelstein', '70cm', 'OE3XNR', 438.6125, -7.6, 88.5, null, 'repeater', 1, ++sortIdx, '03'],
  ['Hohe Wand 70cm', 'Hohe Wand', '70cm', 'OE3XHW', 438.750, -7.6, null, null, 'repeater', 0, ++sortIdx, '03'],
  ['Kaiserkogel 70cm', 'Kaiserkogel', '70cm', 'OE3XPA', 438.450, -7.6, null, null, 'repeater', 0, ++sortIdx, '03'],
  ['Sandl 2m', 'Sandl', '2m', 'OE3XSA', 145.700, -0.6, null, null, 'repeater', 0, ++sortIdx, '03'],
  ['Frauenstaffel 2m', 'Frauenstaffel', '2m', 'OE3XES', 145.7875, -0.6, 79.7, null, 'repeater', 0, ++sortIdx, '03'],
  ['Frauenstaffel 70cm', 'Frauenstaffel', '70cm', 'OE3XEU', 439.025, -7.6, 136.5, null, 'repeater', 0, ++sortIdx, '03'],
  ['Jauerling 70cm', 'Jauerling', '70cm', 'OE3XWJ', 438.425, -7.6, null, null, 'repeater', 1, ++sortIdx, '03'],
  ['Rittmannsberg 70cm', 'Rittmannsberg', '70cm', 'OE3XSU', 438.925, -7.6, null, null, 'repeater', 0, ++sortIdx, '03'],
  ['Jochgrabenberg 70cm', 'Jochgrabenberg', '70cm', 'OE3XFW', 438.975, -7.6, 162.2, null, 'repeater', 0, ++sortIdx, '03'],
  ['Hochkogel 70cm', 'Hochkogel', '70cm', 'OE3XDA', 438.850, -7.6, null, null, 'repeater', 0, ++sortIdx, '03'],
  ['Sonntagberg 70cm', 'Sonntagberg', '70cm', 'OE3XRB', 438.900, -7.6, null, null, 'repeater', 0, ++sortIdx, '03'],
  ['Buschberg 70cm', 'Buschberg', '70cm', null, 438.800, null, null, null, 'repeater', 0, ++sortIdx, '03'],
  ['Mönichkirchen 23cm', 'Mönichkirchen', '23cm', 'OE3XWW', 1298.600, -28, null, null, 'repeater', 0, ++sortIdx, '03'],
  ['Hinteralm 23cm', 'Hinteralm', '23cm', 'OE3XPC', 1298.500, -28, null, null, 'repeater', 0, ++sortIdx, '03'],

  // ─── OE4 Burgenland ───
  ['Sonnenberg 70cm', 'Sonnenberg', '70cm', 'OE4XSB', 438.3625, -7.6, null, null, 'repeater', 0, ++sortIdx, '04'],
  ['Brentenriegel 2m', 'Brentenriegel', '2m', 'OE4XUB', 145.775, -0.6, 97.4, null, 'repeater', 0, ++sortIdx, '04'],

  // ─── OE5 Oberösterreich ───
  ['Grünberg 2m', 'Grünberg', '2m', 'OE5XGL', 145.750, -0.6, 123.0, null, 'repeater', 0, ++sortIdx, '05'],
  ['Grünberg 70cm', 'Grünberg', '70cm', 'OE5XGL', 438.2625, -7.6, null, null, 'repeater', 0, ++sortIdx, '05'],
  ['Geiersberg 2m', 'Geiersberg', '2m', 'OE5XUL', 145.775, -0.6, 123.0, null, 'repeater', 0, ++sortIdx, '05'],
  ['Krippenstein 2m', 'Krippenstein', '2m', 'OE5XKL', 145.7125, -0.6, null, null, 'repeater', 0, ++sortIdx, '05'],
  ['Krippenstein 70cm', 'Krippenstein', '70cm', 'OE5XKL', 438.500, -7.6, null, null, 'repeater', 0, ++sortIdx, '05'],
  ['Lichtenberg 2m', 'Lichtenberg', '2m', 'OE5XLL', 145.600, -0.6, null, null, 'repeater', 0, ++sortIdx, '05'],
  ['Lichtenberg 70cm', 'Lichtenberg', '70cm', 'OE5XLL', 438.650, -7.6, null, null, 'repeater', 0, ++sortIdx, '05'],
  ['Breitenstein 70cm', 'Breitenstein', '70cm', 'OE5XOL', 438.2875, -7.6, null, null, 'repeater', 0, ++sortIdx, '05'],
  ['Sternstein 70cm', 'Sternstein', '70cm', 'OE5XIM', 438.975, -7.6, 123.0, null, 'repeater', 0, ++sortIdx, '05'],
  ['Damberg 70cm', 'Damberg', '70cm', 'OE5XHO', 438.750, -7.6, null, null, 'repeater', 0, ++sortIdx, '05'],
  ['Hunerkogel 70cm', 'Hunerkogel', '70cm', 'OE5XDM', 438.725, -7.6, null, null, 'repeater', 0, ++sortIdx, '05'],
  ['Pfarrkirchen 70cm', 'Pfarrkirchen', '70cm', 'OE5XDO', 438.950, -7.6, null, null, 'repeater', 0, ++sortIdx, '05'],
  ['Feuerkogel 70cm', 'Feuerkogel', '70cm', 'OE5XFK', 438.575, -7.6, 123.0, null, 'repeater', 1, ++sortIdx, '05'],

  // ─── OE6 Steiermark ───
  ['Schöckl 2m', 'Schöckl', '2m', 'OE6XAG', 145.600, -0.6, 103.5, null, 'repeater', 1, ++sortIdx, '06'],
  ['Grambach 70cm', 'Grambach', '70cm', 'OE6XCG', 438.775, -7.6, null, null, 'repeater', 0, ++sortIdx, '06'],
  ['Kindberg 70cm', 'Kindberg', '70cm', 'OE6XME', 438.525, -7.6, null, null, 'repeater', 0, ++sortIdx, '06'],
  ['Lachtal 2m', 'Lachtal', '2m', 'OE6XDG', 145.700, -0.6, null, null, 'repeater', 1, ++sortIdx, '06'],
  ['Dobl 2m', 'Dobl', '2m', 'OE6XDF', 145.6375, -0.6, null, null, 'repeater', 0, ++sortIdx, '06'],
  ['Zirbitzkogel 70cm', 'Zirbitzkogel', '70cm', null, 438.800, null, null, null, 'repeater', 0, ++sortIdx, '06'],

  // ─── OE7 Tirol ───
  ['Hochstein 2m', 'Hochstein', '2m', 'OE7XLI', 145.700, -0.6, 77.0, null, 'repeater', 0, ++sortIdx, '07'],
  ['Hochstein 70cm', 'Hochstein', '70cm', 'OE7XLI', 438.575, -7.6, null, null, 'repeater', 1, ++sortIdx, '07'],
  ['Wurmkogel 2m', 'Wurmkogel', '2m', 'OE7XGI', 145.7875, -0.6, null, null, 'repeater', 0, ++sortIdx, '07'],
  ['Hohe Salve 2m', 'Hohe Salve', '2m', 'OE7XKI', 145.775, -0.6, null, null, 'repeater', 0, ++sortIdx, '07'],
  ['Grünberg Silz 2m', 'Grünberg bei Silz', '2m', 'OE7XWH', 145.6625, -0.6, null, null, 'repeater', 0, ++sortIdx, '07'],
  ['Schönjöchl 70cm', 'Schönjöchl', '70cm', 'OE7XOI', 438.875, -7.6, null, null, 'repeater', 0, ++sortIdx, '07'],
  ['Harschbichl 70cm', 'Harschbichl', '70cm', 'OE7XFJ', 439.025, -7.6, 77.0, null, 'repeater', 0, ++sortIdx, '07'],
  ['Iselsberg 70cm', 'Iselsberg-Stronach', '70cm', 'OE7XLH', 438.625, -7.6, null, null, 'repeater', 0, ++sortIdx, '07'],
  ['Rangger Köpfl 70cm', 'Rangger Köpfl', '70cm', 'OE7XBI', 439.050, -7.6, null, null, 'repeater', 0, ++sortIdx, '07'],
  ['Ahorn 70cm', 'Ahorn', '70cm', 'OE7XZT', 438.975, -7.6, 77.0, null, 'repeater', 1, ++sortIdx, '07'],
  ['Weinbergerhaus 70cm', 'Weinbergerhaus', '70cm', 'OE7XWT', 438.600, -7.6, 77.0, null, 'repeater', 0, ++sortIdx, '07'],
  ['Kaltenbach 70cm', 'Kaltenbach', '70cm', 'OE7XKT', 438.400, -7.6, null, null, 'repeater', 0, ++sortIdx, '07'],
  ['Hollbruck 70cm', 'Hollbruck', '70cm', 'OE7XJH', 438.500, -7.6, 77.0, null, 'repeater', 0, ++sortIdx, '07'],
  ['Zugspitze 2m', 'Zugspitze', '2m', 'OE7XZR', 145.575, -0.6, 77.0, null, 'repeater', 0, ++sortIdx, '07'],
  ['Telfs 70cm', 'Telfs', '70cm', 'OE7XKG', 438.550, -7.6, 77.0, null, 'repeater', 1, ++sortIdx, '07'],

  // ─── OE8 Kärnten ───
  ['Gerlitze 2m', 'Gerlitze', '2m', 'OE8XNK', 145.7625, -0.6, null, 1750, 'repeater', 0, ++sortIdx, '08'],
  ['Gerlitze 70cm', 'Gerlitze', '70cm', 'OE8XNK', 439.050, -7.6, 88.5, null, 'repeater', 0, ++sortIdx, '08'],
  ['Magdalensberg linked', 'Magdalensberg', '70cm', 'OE8XMK', 438.575, -7.6, 88.5, null, 'repeater', 1, ++sortIdx, '08'],
  ['Magdalensberg 2m', 'Magdalensberg', '2m', 'OE8XMK', 145.625, -0.6, 88.5, null, 'repeater', 0, ++sortIdx, '08'],
  ['Goldeck 2m', 'Goldeck', '2m', 'OE8XOK', 145.650, -0.6, 88.5, null, 'repeater', 0, ++sortIdx, '08'],
  ['Petzen 70cm', 'Petzen', '70cm', 'OE8XPK', 438.700, -7.6, null, null, 'repeater', 0, ++sortIdx, '08'],
  ['Villach LKH 70cm', 'Villach LKH', '70cm', 'OE8XVK', 438.550, -7.6, 88.5, null, 'repeater', 0, ++sortIdx, '08'],
  ['Klagenfurt 70cm', 'Klagenfurt', '70cm', 'OE8XCK', 438.650, -7.6, null, null, 'repeater', 0, ++sortIdx, '08'],
  ['Pyramidenkogel 70cm', 'Pyramidenkogel', '70cm', 'OE8XKK', 438.8375, -7.6, null, null, 'repeater', 0, ++sortIdx, '08'],
  ['Dobratsch 23cm', 'Dobratsch', '23cm', null, 1298.150, -28, null, null, 'repeater', 0, ++sortIdx, '08'],

  // ─── OE9 Vorarlberg ───
  ['Karren 70cm', 'Karren', '70cm', 'OE9XKV', 438.625, -7.6, 85.4, null, 'repeater', 0, ++sortIdx, '09'],
  ['Vorderälpele 2m', 'Vorderälpele', '2m', 'OE9XVI', 145.650, -0.6, 85.4, null, 'repeater', 0, ++sortIdx, '09'],
  ['Dornbirn 70cm', 'Dornbirn', '70cm', 'OE9XXD', 438.475, -7.6, 85.4, null, 'repeater', 1, ++sortIdx, '09'],

  // ─── International ───
  ['Struška 70cm', 'Struška', '70cm', 'S55UJE', 439.325, -7.6, 123.0, null, 'repeater', 0, ++sortIdx, '10'],
  ['Hochstuhl 70cm', 'Hochstuhl', '70cm', null, 439.3625, -7.6, 123.0, null, 'repeater', 0, ++sortIdx, '10'],

  // ─── Simplex frequencies (no Bundesland) ───
  ['Direkte 145.500', null, '2m', null, 145.500, null, null, null, 'simplex', 0, ++sortIdx, null],
  ['Direkte 145.525', null, '2m', null, 145.525, null, null, null, 'simplex', 0, ++sortIdx, null],
  ['Direkte 145.550', null, '2m', null, 145.550, null, null, null, 'simplex', 0, ++sortIdx, null],
  ['Direkte 145.300', null, '2m', null, 145.300, null, null, null, 'simplex', 0, ++sortIdx, null],
];
const insertRepMany = db.transaction(() => {
  for (const r of repeaters) insertRep.run(...r);
});
insertRepMany();
console.log(`  ✓ ${repeaters.length} Repeaters`);

// ─── Einstiegspunkte (for Magdalensberg linked) ───
const magRepRow = db.prepare("SELECT id FROM repeaters WHERE short_name = 'Magdalensberg linked'").get() as any;
const magRepId = magRepRow?.id;
if (magRepId) {
  const insertEp = db.prepare('INSERT INTO einstiegspunkte (repeater_id, site_name, callsign, abbreviation, bundesland_code, sort_order) VALUES (?, ?, ?, ?, ?, ?)');
  const einstiegspunkte = [
    [magRepId, 'Hermannskogel', 'OE1XAT', 'HK', '01', 1],
    [magRepId, 'Gaisberg', 'OE2XZR', 'GB', '02', 2],
    [magRepId, 'Nebelstein', 'OE3XNR', 'NBST', '03', 3],
    [magRepId, 'Jauerling', 'OE3XWJ', 'JAU', '03', 4],
    [magRepId, 'Feuerkogel', 'OE5XFK', 'FK', '05', 5],
    [magRepId, 'Schöckl', 'OE6XAG', 'SCHÖ', '06', 6],
    [magRepId, 'Lachtal', 'OE6XDG', 'LT', '06', 7],
    [magRepId, 'Telfs', 'OE7XKG', 'Telfs', '07', 8],
    [magRepId, 'Hochstein', 'OE7XLI', 'Hochstein', '07', 9],
    [magRepId, 'Ahorn', 'OE7XZT', 'Ahorn', '07', 10],
    [magRepId, 'Magdalensberg', 'OE8XMK', 'MK', '08', 11],
    [magRepId, 'Dornbirn', 'OE9XXD', 'DO', '09', 12],
  ];
  const insertEpMany = db.transaction(() => {
    for (const e of einstiegspunkte) insertEp.run(...e);
  });
  insertEpMany();
  console.log(`  ✓ ${einstiegspunkte.length} Einstiegspunkte`);
}

// ─── Default Admin ───
const pinHash = bcrypt.hashSync('changeme', 10);
db.prepare('INSERT INTO admins (callsign, name, pin_hash, role) VALUES (?, ?, ?, ?)').run('OE8YML', 'Admin', pinHash, 'admin');
console.log('  ✓ Default admin OE8YML');

console.log('Seed complete!');
db.close();
