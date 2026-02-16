import type Database from 'better-sqlite3';

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS bundeslaender (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sort_order INTEGER,
      is_international INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS bezirke (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      bundesland_code TEXT REFERENCES bundeslaender(code),
      is_capital INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS operators (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      callsign TEXT UNIQUE NOT NULL,
      name TEXT,
      qth TEXT,
      bezirk_code TEXT REFERENCES bezirke(code),
      bundesland_code TEXT REFERENCES bundeslaender(code),
      is_bos_arsa INTEGER DEFAULT 0,
      is_arena INTEGER DEFAULT 0,
      is_portable INTEGER DEFAULT 0,
      is_exercise_support INTEGER DEFAULT 0,
      gender TEXT,
      email TEXT,
      equipment TEXT,
      antenna TEXT,
      has_emergency_power INTEGER DEFAULT 0,
      has_lighthouse_readiness INTEGER DEFAULT 0,
      latitude REAL,
      longitude REAL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS repeaters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      short_name TEXT NOT NULL,
      site_name TEXT,
      band TEXT,
      callsign TEXT,
      frequency_mhz REAL,
      offset_mhz REAL,
      ctcss_hz REAL,
      burst_hz REAL,
      type TEXT DEFAULT 'repeater',
      is_linked INTEGER DEFAULT 0,
      sort_order INTEGER,
      bundesland_code TEXT REFERENCES bundeslaender(code),
      is_custom INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS einstiegspunkte (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      repeater_id INTEGER REFERENCES repeaters(id),
      site_name TEXT NOT NULL,
      callsign TEXT,
      abbreviation TEXT,
      bundesland_code TEXT REFERENCES bundeslaender(code),
      sort_order INTEGER
    );

    CREATE TABLE IF NOT EXISTS exercises (
      id TEXT PRIMARY KEY,
      name TEXT,
      date TEXT NOT NULL,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS exercise_repeaters (
      exercise_id TEXT REFERENCES exercises(id) ON DELETE CASCADE,
      repeater_id INTEGER REFERENCES repeaters(id),
      operator_callsign TEXT,
      PRIMARY KEY (exercise_id, repeater_id)
    );

    CREATE TABLE IF NOT EXISTS exercise_attendance (
      exercise_id TEXT REFERENCES exercises(id) ON DELETE CASCADE,
      operator_id INTEGER REFERENCES operators(id),
      callsign_suffix TEXT,
      is_present INTEGER DEFAULT 1,
      entered_by TEXT,
      PRIMARY KEY (exercise_id, operator_id)
    );

    CREATE TABLE IF NOT EXISTS signal_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exercise_id TEXT REFERENCES exercises(id) ON DELETE CASCADE,
      operator_id INTEGER REFERENCES operators(id),
      repeater_id INTEGER REFERENCES repeaters(id),
      readability INTEGER,
      strength INTEGER,
      db_over_s9 TEXT,
      einstiegspunkt_id INTEGER REFERENCES einstiegspunkte(id),
      is_op_marker INTEGER DEFAULT 0,
      notes TEXT,
      entered_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE (exercise_id, operator_id, repeater_id)
    );

    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'operator'
    );

    CREATE INDEX IF NOT EXISTS idx_operators_callsign ON operators(callsign);
    CREATE INDEX IF NOT EXISTS idx_operators_bundesland ON operators(bundesland_code);
    CREATE INDEX IF NOT EXISTS idx_operators_bezirk ON operators(bezirk_code);
    CREATE INDEX IF NOT EXISTS idx_signal_reports_exercise ON signal_reports(exercise_id);
    CREATE INDEX IF NOT EXISTS idx_signal_reports_operator ON signal_reports(operator_id);
    CREATE INDEX IF NOT EXISTS idx_signal_reports_repeater ON signal_reports(repeater_id);
    CREATE INDEX IF NOT EXISTS idx_exercise_attendance_exercise ON exercise_attendance(exercise_id);
    CREATE INDEX IF NOT EXISTS idx_einstiegspunkte_repeater ON einstiegspunkte(repeater_id);
    CREATE INDEX IF NOT EXISTS idx_bezirke_bundesland ON bezirke(bundesland_code);
  `);

  // Migration: admins table from callsign/pin_hash to username/password_hash
  const adminCols = db.prepare("PRAGMA table_info(admins)").all() as any[];
  if (adminCols.some((c: any) => c.name === 'callsign')) {
    db.exec("DROP TABLE admins");
    db.exec(`CREATE TABLE admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'operator'
    )`);
  }

  // Migration: convert exercises from INTEGER id to TEXT GUID
  const exCols = db.prepare("PRAGMA table_info(exercises)").all() as any[];
  const idCol = exCols.find((c: any) => c.name === 'id');
  if (idCol && idCol.type === 'INTEGER') {
    // Recreate all exercise-related tables with TEXT exercise_id
    db.exec(`
      CREATE TABLE exercises_new (
        id TEXT PRIMARY KEY,
        name TEXT,
        date TEXT NOT NULL,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE exercise_repeaters_new (
        exercise_id TEXT REFERENCES exercises_new(id) ON DELETE CASCADE,
        repeater_id INTEGER REFERENCES repeaters(id),
        operator_callsign TEXT,
        PRIMARY KEY (exercise_id, repeater_id)
      );
      CREATE TABLE exercise_attendance_new (
        exercise_id TEXT REFERENCES exercises_new(id) ON DELETE CASCADE,
        operator_id INTEGER REFERENCES operators(id),
        callsign_suffix TEXT,
        is_present INTEGER DEFAULT 1,
        entered_by TEXT,
        PRIMARY KEY (exercise_id, operator_id)
      );
      CREATE TABLE signal_reports_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exercise_id TEXT REFERENCES exercises_new(id) ON DELETE CASCADE,
        operator_id INTEGER REFERENCES operators(id),
        repeater_id INTEGER REFERENCES repeaters(id),
        readability INTEGER,
        strength INTEGER,
        db_over_s9 TEXT,
        einstiegspunkt_id INTEGER REFERENCES einstiegspunkte(id),
        is_op_marker INTEGER DEFAULT 0,
        notes TEXT,
        entered_by TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        UNIQUE (exercise_id, operator_id, repeater_id)
      );

      DROP TABLE IF EXISTS signal_reports;
      DROP TABLE IF EXISTS exercise_attendance;
      DROP TABLE IF EXISTS exercise_repeaters;
      DROP TABLE IF EXISTS exercises;

      ALTER TABLE exercises_new RENAME TO exercises;
      ALTER TABLE exercise_repeaters_new RENAME TO exercise_repeaters;
      ALTER TABLE exercise_attendance_new RENAME TO exercise_attendance;
      ALTER TABLE signal_reports_new RENAME TO signal_reports;
    `);
  }

  // Migrations for existing databases
  const cols = db.prepare("PRAGMA table_info(exercises)").all() as any[];
  if (!cols.some((c: any) => c.name === 'name')) {
    db.exec("ALTER TABLE exercises ADD COLUMN name TEXT");
  }
  if (!cols.some((c: any) => c.name === 'oe_link_enabled')) {
    db.exec("ALTER TABLE exercises ADD COLUMN oe_link_enabled INTEGER DEFAULT 1");
  }
  if (!cols.some((c: any) => c.name === 'organisator')) {
    db.exec("ALTER TABLE exercises ADD COLUMN organisator TEXT");
  }

  const repCols = db.prepare("PRAGMA table_info(repeaters)").all() as any[];
  if (!repCols.some((c: any) => c.name === 'bundesland_code')) {
    db.exec("ALTER TABLE repeaters ADD COLUMN bundesland_code TEXT REFERENCES bundeslaender(code)");
  }
  if (!repCols.some((c: any) => c.name === 'is_custom')) {
    db.exec("ALTER TABLE repeaters ADD COLUMN is_custom INTEGER DEFAULT 0");
  }

  // Create index after migration ensures column exists
  db.exec("CREATE INDEX IF NOT EXISTS idx_repeaters_bundesland ON repeaters(bundesland_code)");
}
