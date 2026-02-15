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
const insertRep = db.prepare(`INSERT INTO repeaters (short_name, site_name, band, callsign, frequency_mhz, offset_mhz, ctcss_hz, burst_hz, type, is_linked, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
const repeaters: any[][] = [
  ['Gerlitze 2m', 'Gerlitze', '2m', 'OE8XNK', 145.7625, -0.6, null, 1750, 'repeater', 0, 1],
  ['Gerlitze 70cm', 'Gerlitze', '70cm', 'OE8XNK', 439.050, -7.6, 88.5, null, 'repeater', 0, 2],
  ['Magdalensberg linked', 'Magdalensberg', '70cm', 'OE8XMK', 438.575, -7.6, 88.5, null, 'repeater', 1, 3],
  ['Buschberg', 'Buschberg', '70cm', null, 438.800, null, null, null, 'repeater', 0, 4],
  ['Goldeck 2m', 'Goldeck', '2m', 'OE8XOK', 145.650, -0.6, 88.5, null, 'repeater', 0, 5],
  ['Dobratsch 23cm', 'Dobratsch', '23cm', null, 1298.150, -28, null, null, 'repeater', 0, 6],
  ['Struška', 'Struška', '70cm', 'S55UJE', 439.325, -7.6, 123.0, null, 'repeater', 0, 7],
  ['Hochstuhl', 'Hochstuhl', '70cm', null, 439.3625, -7.6, 123.0, null, 'repeater', 0, 8],
  ['Zirbitzkogel', 'Zirbitzkogel', '70cm', null, 438.800, null, null, null, 'repeater', 0, 9],
  ['Direkte 145.300', null, '2m', null, 145.300, null, null, null, 'simplex', 0, 10],
  ['Direkte 145.525', null, '2m', null, 145.525, null, null, null, 'simplex', 0, 11],
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
