import * as SQLite from "expo-sqlite";

// On-device store for documents / chunks / playback positions. No server, no
// auth — a single implicit local user. Preferences live in AsyncStorage via
// store/preferences.ts, not here.

const DB_NAME = "readit.db";

// Each entry migrates the schema forward by one and bumps PRAGMA user_version.
// Append only — never edit or reorder existing entries.
const MIGRATIONS: Array<(db: SQLite.SQLiteDatabase) => Promise<void>> = [
  async (db) => {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS documents (
        id           TEXT PRIMARY KEY,
        title        TEXT NOT NULL,
        source_type  TEXT NOT NULL CHECK (source_type IN ('paste','web','pdf','photo')),
        source_ref   TEXT,
        language     TEXT,
        char_count   INTEGER NOT NULL DEFAULT 0,
        chunk_count  INTEGER NOT NULL DEFAULT 0,
        status       TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('processing','ready','error')),
        error_msg    TEXT,
        created_at   TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS document_chunks (
        document_id  TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        seq          INTEGER NOT NULL,
        content      TEXT NOT NULL,
        PRIMARY KEY (document_id, seq)
      );

      CREATE TABLE IF NOT EXISTS playback_positions (
        document_id  TEXT PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
        chunk_seq    INTEGER NOT NULL DEFAULT 0,
        updated_at   TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_chunks_doc ON document_chunks(document_id);
    `);
  },
];

async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version"
  );
  const current = row?.user_version ?? 0;
  for (let i = current; i < MIGRATIONS.length; i++) {
    await MIGRATIONS[i](db);
    await db.execAsync(`PRAGMA user_version = ${i + 1}`);
  }
}

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function open(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.execAsync("PRAGMA journal_mode = WAL");
  await db.execAsync("PRAGMA foreign_keys = ON");
  try {
    await runMigrations(db);
  } catch (err) {
    // Pre-launch: a corrupt/incompatible DB is not worth recovering. Drop and
    // recreate. Metadata only — never log document content (CLAUDE.md rule 6).
    console.warn("db: migration failed, recreating", (err as Error)?.name);
    await db.closeAsync();
    await SQLite.deleteDatabaseAsync(DB_NAME);
    const fresh = await SQLite.openDatabaseAsync(DB_NAME);
    await fresh.execAsync("PRAGMA journal_mode = WAL");
    await fresh.execAsync("PRAGMA foreign_keys = ON");
    await runMigrations(fresh);
    return fresh;
  }
  return db;
}

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) dbPromise = open();
  return dbPromise;
}

export async function initDb(): Promise<void> {
  await getDb();
}
