import { afterAll, describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { URL } from 'node:url';
import type { DatabaseSync as SQLiteDatabase } from 'node:sqlite';
import { Miniflare } from 'miniflare';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const migrationPath = new URL('../../migrations/0017_repair_lesson_foreign_keys.sql', import.meta.url);
const historical = readdirSync(new URL('../../migrations/', import.meta.url))
  .filter(name => /^00(?:0[0-9]|1[0-6])_.*\.sql$/.test(name)).sort()
  .map(name => ({ name, sql: readFileSync(new URL(`../../migrations/${name}`, import.meta.url), 'utf8') }));
const targets = ['lesson_progress', 'lecture_playback_logs', 'quizzes', 'quiz_questions', 'quiz_attempts'];
const creationOrder = ['quizzes', 'lesson_progress', 'lecture_playback_logs', 'quiz_questions', 'quiz_attempts'];
const dropOrder = ['quiz_questions', 'quiz_attempts', 'quizzes', 'lesson_progress', 'lecture_playback_logs'];
const cleanSql = (sql: string) => sql.split('\n').map(line => line.replace(/--.*$/, '').trim()).filter(Boolean).join(' ');
const quote = (value: unknown): string => value === null ? 'NULL' : typeof value === 'number' ? String(value) : `'${String(value).replace(/'/g, "''")}'`;
const identifier = (value: string) => `"${value.replace(/"/g, '""')}"`;
type Row = Record<string, string | number | null>;
type Schema = { type: string; name: string; tbl_name: string; sql: string | null };
type Mutation = { version?: string; from?: string; to?: string; after?: string };

// Synthetic fixtures are inserted as the historical migrations introduce tables.
// No user database or external service is used, including during failure tests.
const seeds: Record<string, string[]> = {
  '0000': [
    "INSERT INTO profiles(id,supabase_user_id,email,role,full_name) VALUES ('admin','admin-auth','admin@example.invalid','admin','Synthetic Admin'),('student','student-auth','student@example.invalid','student','Synthetic Student')",
    "INSERT INTO courses(id,title,slug,subject,created_by,is_published) VALUES ('course','Synthetic Course','synthetic-course','Test','admin',1)",
    "INSERT INTO units(id,course_id,title,is_published) VALUES ('unit','course','Synthetic Unit',1)",
    "INSERT INTO lessons(id,unit_id,course_id,title,is_published,duration_seconds) VALUES ('lesson','unit','course','Synthetic Lesson',1,300)",
    "INSERT INTO lesson_videos(id,lesson_id,provider,youtube_id,status,duration_seconds) VALUES ('video-youtube','lesson','youtube','synthetic','ready',300)",
    "INSERT INTO lesson_files(id,lesson_id,title,r2_key,size_bytes) VALUES ('file','lesson','Synthetic File','synthetic/file.pdf',123)",
    "INSERT INTO code_batches(id,name,scope_type,course_id,quantity,created_by) VALUES ('batch','Synthetic Batch','course','course',1,'admin')",
    "INSERT INTO activation_codes(id,code,batch_id,scope_type,course_id,created_by,used_by,used_count) VALUES ('code','SYNTHETIC-NOT-REDEEMABLE','batch','course','course','admin','student',1)",
    "INSERT INTO enrollments(id,student_id,course_id,code_id) VALUES ('enrollment','student','course','code')",
    "INSERT INTO lesson_progress(id,student_id,lesson_id,course_id,watched_seconds,last_position,highest_position_watched,is_completed,completed_at,updated_at) VALUES ('progress','student','lesson','course',137,121,150,1,'2026-01-01T01:02:03Z','2026-01-02T01:02:03Z')",
    "INSERT INTO questions(id,student_id,lesson_id,course_id,body,status) VALUES ('question','student','lesson','course','Synthetic question','answered')",
    "INSERT INTO answers(id,question_id,author_id,body,is_accepted) VALUES ('answer','question','admin','Synthetic answer',1)",
    "INSERT INTO reviews(id,student_id,target_type,target_id,rating,comment) VALUES ('review','student','lesson','lesson',4,'Synthetic review')",
    "INSERT INTO devices(id,student_id,device_id,platform,model) VALUES ('device','student','synthetic-device','android','Synthetic')",
    "INSERT INTO notifications(id,recipient_id,course_id,type,title,body) VALUES ('notification','student','course','system','Synthetic notification','Synthetic body')",
    "INSERT INTO bundles(id,title) VALUES ('bundle','Synthetic Bundle')",
    "INSERT INTO bundle_courses(bundle_id,course_id) VALUES ('bundle','course')",
    "INSERT INTO audit_logs(id,actor_id,action,target_type,target_id) VALUES ('audit','admin','synthetic_fixture','lesson','lesson')",
  ],
  '0001': [
    "INSERT INTO financial_transactions(id,student_id,course_id,amount,transaction_type,code_id,note) VALUES ('transaction','student','course',1234,'code_redeem','code','Synthetic')",
    "INSERT INTO lecture_playback_logs(id,student_id,lesson_id,action,position_seconds,created_at) VALUES ('playback','student','lesson','close',137,'2026-01-02T00:00:00Z')",
    "INSERT INTO quizzes(id,course_id,lesson_id,title,max_score,is_published,sort_order,created_at,updated_at) VALUES ('quiz','course','lesson','Linked Quiz',17,1,3,'2026-01-01T00:00:00Z','2026-01-02T00:00:00Z'),('unlinked','course',NULL,'Unlinked Quiz',19,0,4,'2026-01-01T00:00:00Z','2026-01-02T00:00:00Z')",
    "INSERT INTO quiz_attempts(id,student_id,quiz_id,score,submitted_at,created_at) VALUES ('attempt','student','quiz',7.5,'2026-01-03T00:00:00Z','2026-01-01T00:00:00Z')",
  ],
  '0002': [
    "INSERT INTO assistant_permissions(id,assistant_id,can_grade_quizzes) VALUES ('permissions','admin',1)",
    "INSERT INTO device_reset_requests(id,student_id,device_id,platform,reason,handled_by) VALUES ('reset','student','synthetic-device','android','Synthetic','admin')",
  ],
  '0004': [
    "INSERT INTO lesson_videos(id,lesson_id,provider,stream_uid,status,duration_seconds) VALUES ('video-r2','lesson','r2','synthetic/r2.mp4','ready',302),('video-hls','lesson','r2_hls','synthetic/hls.m3u8','ready',303),('video-server','lesson','server','synthetic/server.mp4','ready',304)",
  ],
  '0005': ['profiles', 'courses', 'code_batches', 'activation_codes', 'enrollments', 'notifications', 'audit_logs']
    .map(table => `UPDATE ${table} SET platform='synthetic-tenant'`),
  '0007': [
    `INSERT INTO quiz_questions(id,quiz_id,question_text,image_url,options_json,correct_option,score,sort_order,created_at,updated_at) VALUES ('quiz-question','quiz','Synthetic question','synthetic/image.png','["A","B"]','A',17,3,'2026-01-01T00:00:00Z','2026-01-02T00:00:00Z'),('control-question','unlinked',NULL,NULL,'["A","B"]','B',19,4,'2026-01-01T00:00:00Z','2026-01-02T00:00:00Z')`,
    `UPDATE quiz_attempts SET answers_json='{"quiz-question":"A"}'`,
  ],
  '0008': [
    "UPDATE quizzes SET randomize_questions=1,start_time='2026-01-01T00:00:00Z',end_time='2026-01-04T00:00:00Z',time_limit_mins=15",
    "UPDATE quiz_attempts SET started_at='2026-01-01T00:00:00Z',is_submitted=0",
  ],
  '0012': ["UPDATE quizzes SET is_free=1"],
  '0013': ["UPDATE quizzes SET cover_image='synthetic/cover.png'"],
  '0014': ["INSERT INTO push_subscriptions(id,device_id,platform,push_token,student_id,platform_key) VALUES ('push','synthetic-device','android','synthetic-not-a-token','student','synthetic-tenant')"],
};

function replay(populated = true, cleaned = false, mutation: Mutation = {}): SQLiteDatabase {
  const db = new DatabaseSync(':memory:');
  try {
    for (const file of historical) {
      let sql = file.sql;
      if (file.name.startsWith(mutation.version || '!')) {
        if (!mutation.from || !sql.includes(mutation.from)) throw new Error('Invalid test mutation');
        sql = sql.replace(mutation.from, mutation.to!);
      }
      db.exec(cleaned ? cleanSql(sql) : sql);
      if (populated) for (const seed of seeds[file.name.slice(0, 4)] || []) db.exec(seed);
    }
    if (mutation.after) {
      // Only corrupt disposable fixtures; the repair itself never disables FKs.
      db.exec('PRAGMA foreign_keys=OFF');
      db.exec(mutation.after);
    }
    db.exec('PRAGMA foreign_keys=ON');
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}

const schemaQuery = "SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE name NOT LIKE '_cf_%' ORDER BY type,name";
const reference = replay(false);
const cleanedReference = replay(false, true);
const expectedSchema = reference.prepare(schemaQuery).all() as unknown as Schema[];
const expectedCleanedSchema = cleanedReference.prepare(schemaQuery).all() as unknown as Schema[];
const affectedSchema = expectedSchema.filter(row => targets.includes(row.tbl_name));
const namedIndices = affectedSchema.filter(row => row.type === 'index' && row.sql);
const columns = Object.fromEntries(targets.map(table => [table,
  (reference.prepare(`PRAGMA table_info(${table})`).all() as Row[]).map(row => String(row.name)),
]));
reference.close();
cleanedReference.close();

// Exact SQL allowlist, not whitespace-stripping: whitespace INSIDE a default or
// CHECK literal is significant. Accept only the raw and legacy D1-cleaned replay.
// JSON escaping also keeps legacy comment removers from corrupting quoted SQL.
function buildCandidate(): string {
  const allowlist = affectedSchema.map(row => ({ ...row,
    cleaned: expectedCleanedSchema.find(other => other.name === row.name)!.sql,
  }));
  const encoded = quote(JSON.stringify(allowlist).replace(/-/g, '\\u002d'));
  const names = targets.map(quote).join(',');
  const reserved = ['lessons_old', ...targets.map(table => `${table}__0017`)].map(quote).join(',');
  const guard = `WITH expected AS (
  SELECT json_extract(value,'$.type') AS type, json_extract(value,'$.name') AS name,
         json_extract(value,'$.tbl_name') AS tbl_name, json_extract(value,'$.sql') AS sql,
         json_extract(value,'$.cleaned') AS cleaned
  FROM json_each(${encoded})
)
SELECT CASE WHEN
  (SELECT foreign_keys FROM pragma_foreign_keys)=1
  AND NOT EXISTS (SELECT 1 FROM sqlite_schema WHERE type IN ('trigger','view'))
  AND NOT EXISTS (SELECT 1 FROM sqlite_schema WHERE name COLLATE NOCASE IN (${reserved}))
  AND (SELECT count(*) FROM sqlite_schema WHERE tbl_name IN (${names}))=(SELECT count(*) FROM expected)
  AND NOT EXISTS (
    SELECT 1 FROM expected e LEFT JOIN sqlite_schema s ON s.name=e.name
    WHERE s.name IS NULL OR s.type<>e.type OR s.tbl_name<>e.tbl_name
       OR NOT (s.sql IS e.sql OR s.sql IS e.cleaned)
  )
  AND NOT EXISTS (
    SELECT 1 FROM sqlite_schema s, pragma_foreign_key_list(s.name) f
    WHERE s.type='table' AND s.name NOT IN (${names})
      AND f."table" COLLATE NOCASE IN (${names},${reserved})
  )
THEN 1 ELSE json('0017 rejected: unexpected schema, dependency, reserved name, or disabled foreign keys') END AS repair_preflight;`;
  const check = (phase: string) => `SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM pragma_foreign_key_check)
THEN 1 ELSE json('0017 rejected: orphan records ${phase}') END AS repair_integrity;`;
  const statements = [
    '-- Repair only the three stale lesson FKs and preserve both quiz child tables.',
    '-- The migration runner MUST own one transaction covering this entire file.',
    '-- Fail closed on drift. No existing lessons_old or __0017 object is accepted.',
    'PRAGMA defer_foreign_keys=ON;', guard,
    '-- A normal, short-lived parent makes dropping the broken original tables safe.',
    'CREATE TABLE lessons_old (id TEXT PRIMARY KEY);',
    'INSERT INTO lessons_old (id) SELECT id FROM lessons;',
    check('before repair'),
    ...creationOrder.map(table => {
      let sql = expectedSchema.find(row => row.type === 'table' && row.name === table)!.sql!;
      sql = cleanSql(sql).replace(`CREATE TABLE ${table} (`, `CREATE TABLE ${table}__0017 (`)
        .replace('REFERENCES "lessons_old"(id)', 'REFERENCES lessons(id)');
      if (table === 'quiz_questions' || table === 'quiz_attempts') sql = sql.replace('REFERENCES quizzes(id)', 'REFERENCES quizzes__0017(id)');
      return `${sql};`;
    }),
    ...creationOrder.map(table => {
      const list = ['rowid', ...columns[table]].map(identifier).join(', ');
      return `INSERT INTO ${table}__0017 (${list}) SELECT ${list} FROM ${table};`;
    }),
    '-- Drop original quiz children first so CASCADE cannot erase their copied rows.',
    ...dropOrder.map(table => `DROP TABLE ${table};`),
    '-- Rename the quiz parent first; SQLite rewrites both shadow child references.',
    ...creationOrder.map(table => `ALTER TABLE ${table}__0017 RENAME TO ${table};`),
    ...namedIndices.map(row => `${row.sql};`),
    'DROP TABLE lessons_old;', check('after repair'),
  ];
  return `${statements.join('\n\n')}\n`;
}

export const candidateSql = buildCandidate();
const published = existsSync(migrationPath);
const repairSql = published ? readFileSync(migrationPath, 'utf8') : candidateSql;
// No triggers, semicolons in literals, or multi-statement bodies in this migration.
const statements = cleanSql(repairSql).split(';').map(sql => sql.trim()).filter(Boolean);
const blockedFetch = vi.fn(async () => { throw new Error('Outbound network is forbidden in migration repair tests'); });

interface Database {
  query(sql: string): Promise<Row[]>;
  batch(sql: string[]): Promise<void>;
}

async function withDatabase(engine: string, mutation: Mutation, run: (db: Database) => Promise<void>) {
  const sqlite = replay(true, false, mutation);
  if (engine === 'SQLite') {
    const db: Database = {
      async query(sql) { return sqlite.prepare(sql).all() as Row[]; },
      async batch(sql) {
        sqlite.exec('BEGIN');
        try {
          for (const statement of sql) sqlite.exec(statement);
          sqlite.exec('COMMIT');
        } catch (error) {
          sqlite.exec('ROLLBACK');
          throw error;
        }
      },
    };
    try { await run(db); } finally { sqlite.close(); }
    return;
  }
  const mf = new Miniflare({
    script: 'export default { fetch() { return new Response("fixture"); } }',
    modules: true, host: '127.0.0.1', cf: false, outboundService: blockedFetch,
    d1Databases: ['DB'], d1Persist: false,
  });
  try {
    const d1 = await mf.getD1Database('DB');
    const db: Database = {
      async query(sql) { return (await d1.prepare(sql).all()).results as Row[]; },
      async batch(sql) { await d1.batch(sql.map(statement => d1.prepare(statement))); },
    };
    const schema = sqlite.prepare(schemaQuery).all() as unknown as Schema[];
    // D1 cannot disable foreign_keys. Import the historical broken snapshot with
    // an EMPTY compatibility parent and deferred checks, clearing deferral only
    // during fixture setup. Dropping an empty parent cannot cascade fixture rows.
    // Every repair batch starts with foreign_keys=1 and defer_foreign_keys=0.
    const setup = ['PRAGMA defer_foreign_keys=ON'];
    if (!schema.some(row => row.name === 'lessons_old')) setup.push('CREATE TABLE lessons_old (id TEXT PRIMARY KEY)');
    setup.push(...schema.filter(row => row.type === 'table' && row.sql).map(row => row.sql!));
    for (const table of schema.filter(row => row.type === 'table')) {
      for (const row of sqlite.prepare(`SELECT rowid AS __rowid, * FROM ${identifier(table.name)}`).all() as Row[]) {
        const names = Object.keys(row).map(name => identifier(name === '__rowid' ? 'rowid' : name));
        setup.push(`INSERT INTO ${identifier(table.name)} (${names.join(',')}) VALUES (${Object.values(row).map(quote).join(',')})`);
      }
    }
    setup.push(...schema.filter(row => row.type !== 'table' && row.sql).map(row => row.sql!));
    if (!schema.some(row => row.name === 'lessons_old')) setup.push('DROP TABLE lessons_old');
    setup.push('PRAGMA defer_foreign_keys=OFF');
    await db.batch(setup);
    expect(await db.query('PRAGMA foreign_keys')).toEqual([{ foreign_keys: 1 }]);
    expect(await db.query('PRAGMA defer_foreign_keys')).toEqual([{ defer_foreign_keys: 0 }]);
    await run(db);
  } finally {
    sqlite.close();
    await mf.dispose();
  }
}

async function snapshot(db: Database) {
  const schema = await db.query(schemaQuery);
  const rows: Record<string, Row[]> = {};
  const definitions: Record<string, { columns: Row[]; fks: Row[]; indices: Row[]; indexColumns: Record<string, Row[]> }> = {};
  for (const table of schema.filter(row => row.type === 'table')) {
    const name = String(table.name);
    rows[name] = await db.query(`SELECT rowid AS __rowid, * FROM ${identifier(name)} ORDER BY rowid`);
    const indices = (await db.query(`PRAGMA index_list(${identifier(name)})`))
      .map(({ seq: _seq, ...row }) => row).sort((a, b) => String(a.name).localeCompare(String(b.name)));
    const indexColumns: Record<string, Row[]> = {};
    for (const index of indices) indexColumns[String(index.name)] = await db.query(`PRAGMA index_xinfo(${identifier(String(index.name))})`);
    definitions[name] = {
      columns: await db.query(`PRAGMA table_xinfo(${identifier(name)})`),
      fks: await db.query(`PRAGMA foreign_key_list(${identifier(name)})`), indices, indexColumns,
    };
  }
  return { schema, rows, definitions, violations: await db.query('PRAGMA foreign_key_check') };
}

const drifts: [string, Mutation][] = [
  ...targets.map(table => [`added column on ${table}`, { after: `ALTER TABLE ${table} ADD COLUMN preserved_sentinel TEXT; UPDATE ${table} SET preserved_sentinel='must not disappear'` }] as [string, Mutation]),
  ...targets.map(table => [`renamed column on ${table}`, { after: `ALTER TABLE ${table} RENAME COLUMN id TO preserved_identifier` }] as [string, Mutation]),
  ['changed progress type', { version: '0000', from: 'watched_seconds          INTEGER', to: 'watched_seconds          TEXT', after: "UPDATE lesson_progress SET watched_seconds='137 seconds'" }],
  ['changed progress uniqueness', { version: '0000', from: 'UNIQUE(student_id, lesson_id)', to: 'UNIQUE(id, student_id, lesson_id)', after: "INSERT INTO lesson_progress(id,student_id,lesson_id,course_id) VALUES ('duplicate','student','lesson','course')" }],
  ['changed log CHECK', { version: '0001', from: "CHECK(action IN ('open', 'close'))", to: "CHECK(action IN ('open', 'close', 'pause'))", after: "UPDATE lecture_playback_logs SET action='pause'" }],
  ['changed literal whitespace', { version: '0001', from: "CHECK(action IN ('open', 'close'))", to: "CHECK(action IN ('op en', 'close'))" }],
  ['changed quiz CHECK', { version: '0012', from: 'CHECK(is_free IN (0, 1))', to: 'CHECK(is_free IN (0, 1, 2))', after: 'UPDATE quizzes SET is_free=2' }],
  ['changed question nullability', { version: '0007', from: 'options_json    TEXT NOT NULL', to: 'options_json    TEXT', after: 'UPDATE quiz_questions SET options_json=NULL' }],
  ['changed attempt CHECK', { version: '0008', from: 'CHECK(is_submitted IN (0, 1))', to: 'CHECK(is_submitted IN (0, 1, 2))', after: 'UPDATE quiz_attempts SET is_submitted=2' }],
  ['changed attempt uniqueness', { version: '0001', from: 'UNIQUE(student_id, quiz_id)', to: 'UNIQUE(id, student_id, quiz_id)', after: "INSERT INTO quiz_attempts(id,student_id,quiz_id) VALUES ('duplicate','student','quiz')" }],
  ['extra index', { after: 'CREATE INDEX unexpected_index ON quizzes(title)' }],
  ['changed named index', { after: 'DROP INDEX idx_quizzes_lesson; CREATE INDEX idx_quizzes_lesson ON quizzes(title) WHERE is_free=1' }],
  ['missing index', { after: 'DROP INDEX idx_quiz_attempts_quiz' }],
  ['unexpected trigger', { after: 'CREATE TRIGGER unexpected_trigger AFTER DELETE ON quizzes BEGIN UPDATE courses SET title=title; END' }],
  ['unexpected view', { after: 'CREATE VIEW unexpected_view AS SELECT * FROM quizzes' }],
  ['incoming cascade dependency', { after: "CREATE TABLE unexpected_child(id TEXT PRIMARY KEY, quiz_id TEXT REFERENCES quizzes(id) ON DELETE CASCADE); INSERT INTO unexpected_child VALUES ('keep','quiz')" }],
  ['existing compatibility table', { after: "CREATE TABLE lessons_old(id TEXT PRIMARY KEY); INSERT INTO lessons_old VALUES ('keep')" }],
  ['existing shadow table', { after: "CREATE TABLE quizzes__0017(id TEXT PRIMARY KEY); INSERT INTO quizzes__0017 VALUES ('keep')" }],
];

it('pins the complete historical replay and exact published candidate', () => {
  expect(historical).toHaveLength(17);
  expect(namedIndices).toHaveLength(11);
  expect(repairSql).toBe(candidateSql);
  expect(repairSql).not.toMatch(/\bBEGIN\b|PRAGMA\s+foreign_keys\s*=\s*OFF|ALTER TABLE lessons RENAME/i);
  expect(statements[0]).toBe('PRAGMA defer_foreign_keys=ON');
  for (const child of ['quiz_questions', 'quiz_attempts']) {
    expect(statements.find(sql => sql.startsWith(`CREATE TABLE ${child}__0017`))).toContain('REFERENCES quizzes__0017(id)');
  }
});

for (const engine of ['SQLite', 'Miniflare D1']) describe(engine, () => {
  it('preserves all 31 rows in 25 populated tables, exact columns, all indices, and FK actions', async () => {
    await withDatabase(engine, {}, async db => {
      const before = await snapshot(db);
      expect(Object.values(before.rows).flat()).toHaveLength(31);
      expect(Object.values(before.rows).filter(rows => rows.length)).toHaveLength(25);
      expect(before.violations).toHaveLength(3);
      expect(before.violations.map(row => row.table).sort()).toEqual(['lecture_playback_logs', 'lesson_progress', 'quizzes']);
      await db.batch(statements);
      const after = await snapshot(db);
      expect(after.rows).toEqual(before.rows);
      expect(after.schema.filter(row => row.type === 'index')).toEqual(before.schema.filter(row => row.type === 'index'));
      expect(after.schema.filter(row => !targets.includes(String(row.tbl_name)))).toEqual(before.schema.filter(row => !targets.includes(String(row.tbl_name))));
      for (const [name, definition] of Object.entries(before.definitions)) {
        expect(after.definitions[name]).toEqual({ ...definition, fks: definition.fks.map(fk => ({ ...fk, table: fk.table === 'lessons_old' ? 'lessons' : fk.table })) });
      }
      expect(after.violations).toEqual([]);
      expect(await db.query('PRAGMA foreign_keys')).toEqual([{ foreign_keys: 1 }]);
      expect(await db.query('PRAGMA defer_foreign_keys')).toEqual([{ defer_foreign_keys: 0 }]);
      expect(after.definitions.lesson_progress.fks.find(fk => fk.from === 'lesson_id')?.on_delete).toBe('NO ACTION');
      expect(after.definitions.lecture_playback_logs.fks.find(fk => fk.from === 'lesson_id')?.on_delete).toBe('CASCADE');
      expect(after.definitions.quizzes.fks.find(fk => fk.from === 'lesson_id')?.on_delete).toBe('SET NULL');
      expect(after.definitions.lesson_progress.columns.some(col => col.name === 'platform')).toBe(true);
      expect(after.definitions.lesson_videos.columns.some(col => col.name === 'platform')).toBe(false);
    });
  }, 30000);

  it('accepts valid inserts and enforces all repaired FKs, CHECKs, and unique keys', async () => {
    await withDatabase(engine, {}, async db => {
      await db.batch(statements);
      await db.batch([
        "INSERT INTO lessons(id,unit_id,course_id,title) VALUES ('fresh','unit','course','Fresh')",
        "INSERT INTO lesson_progress(id,student_id,lesson_id,course_id,platform) VALUES ('fresh-progress','student','fresh','course','second-tenant')",
        "INSERT INTO lecture_playback_logs(id,student_id,lesson_id,action) VALUES ('fresh-log','student','fresh','open')",
        "INSERT INTO quizzes(id,course_id,lesson_id,title) VALUES ('fresh-quiz','course','fresh','Fresh Quiz')",
        `INSERT INTO quiz_questions(id,quiz_id,options_json,correct_option) VALUES ('fresh-question','fresh-quiz','["A"]','A')`,
        "INSERT INTO quiz_attempts(id,student_id,quiz_id) VALUES ('fresh-attempt','student','fresh-quiz')",
      ]);
      const before = await snapshot(db);
      for (const sql of [
        "UPDATE lesson_progress SET lesson_id='missing' WHERE id='fresh-progress'",
        "UPDATE lecture_playback_logs SET lesson_id='missing' WHERE id='fresh-log'",
        "UPDATE quizzes SET lesson_id='missing' WHERE id='fresh-quiz'",
        "UPDATE quiz_questions SET quiz_id='missing' WHERE id='fresh-question'",
        "UPDATE quiz_attempts SET quiz_id='missing' WHERE id='fresh-attempt'",
        "UPDATE lecture_playback_logs SET action='pause' WHERE id='fresh-log'",
        "UPDATE quizzes SET is_published=2", "UPDATE quizzes SET randomize_questions=2", "UPDATE quizzes SET is_free=2",
        "UPDATE quiz_attempts SET is_submitted=2",
        "UPDATE lesson_progress SET lesson_id='lesson' WHERE id='fresh-progress'",
        "UPDATE quiz_attempts SET quiz_id='quiz' WHERE id='fresh-attempt'",
        "UPDATE quizzes SET id='quiz' WHERE id='fresh-quiz'",
        'UPDATE quiz_questions SET options_json=NULL',
      ]) await expect(db.batch([sql])).rejects.toThrow();
      expect(await snapshot(db)).toEqual(before);
      expect(await db.query('PRAGMA foreign_key_check')).toEqual([]);
    });
  }, 30000);

  it('preserves NO ACTION, CASCADE, SET NULL, and both quiz child cascades', async () => {
    await withDatabase(engine, {}, async db => {
      await db.batch(statements);
      const before = await snapshot(db);
      await expect(db.batch(["DELETE FROM lessons WHERE id='lesson'"])).rejects.toThrow();
      expect(await snapshot(db)).toEqual(before);
      await db.batch(["DELETE FROM lesson_progress WHERE id='progress'", "DELETE FROM lessons WHERE id='lesson'"]);
      expect(await db.query('SELECT * FROM lecture_playback_logs')).toEqual([]);
      expect(await db.query("SELECT lesson_id FROM quizzes WHERE id='quiz'")).toEqual([{ lesson_id: null }]);
      expect(await db.query('SELECT rowid AS __rowid,* FROM quiz_questions ORDER BY rowid')).toEqual(before.rows.quiz_questions);
      expect(await db.query('SELECT rowid AS __rowid,* FROM quiz_attempts ORDER BY rowid')).toEqual(before.rows.quiz_attempts);
      await db.batch(["DELETE FROM quizzes WHERE id='quiz'"]);
      expect(await db.query("SELECT * FROM quiz_questions WHERE quiz_id='quiz'")).toEqual([]);
      expect(await db.query("SELECT * FROM quiz_attempts WHERE quiz_id='quiz'")).toEqual([]);
      expect(await db.query("SELECT id FROM quiz_questions WHERE quiz_id='unlinked'")).toEqual([{ id: 'control-question' }]);
      expect(await db.query('PRAGMA foreign_key_check')).toEqual([]);
    });
  }, 30000);

  for (const marker of ['INSERT INTO quiz_attempts__0017', 'DROP TABLE lecture_playback_logs', 'ALTER TABLE quiz_attempts__0017', 'CREATE INDEX idx_quizzes_lesson', 'DROP TABLE lessons_old']) {
    it(`rolls back the entire batch after injected failure following ${marker}`, async () => {
      await withDatabase(engine, {}, async db => {
        const before = await snapshot(db);
        const index = statements.findIndex(sql => sql.startsWith(marker));
        expect(index).toBeGreaterThan(0);
        const failing = [...statements.slice(0, index + 1), "SELECT json('injected repair failure')", ...statements.slice(index + 1)];
        await expect(db.batch(failing)).rejects.toThrow();
        expect(await snapshot(db)).toEqual(before);
        expect(await db.query('PRAGMA foreign_keys')).toEqual([{ foreign_keys: 1 }]);
        await db.batch(statements);
        expect(await db.query('PRAGMA foreign_key_check')).toEqual([]);
      });
    }, 30000);
  }

  for (const table of targets) it(`rolls back orphan records in ${table}`, async () => {
    const column = table.startsWith('quiz_') ? 'quiz_id' : 'lesson_id';
    await withDatabase(engine, { after: `UPDATE ${table} SET ${column}='missing'` }, async db => {
      const before = await snapshot(db);
      await expect(db.batch(statements)).rejects.toThrow();
      expect(await snapshot(db)).toEqual(before);
    });
  }, 30000);

  for (const [name, mutation] of drifts) it(`rejects ${name} without losing schema or values`, async () => {
    await withDatabase(engine, mutation, async db => {
      const before = await snapshot(db);
      await expect(db.batch(statements)).rejects.toThrow();
      expect(await snapshot(db)).toEqual(before);
    });
  }, 30000);
});

it('rejects disabled native SQLite FK enforcement before any DDL', () => {
  const db = replay();
  try {
    db.exec('PRAGMA foreign_keys=OFF; BEGIN');
    expect(() => db.exec(repairSql)).toThrow();
    db.exec('ROLLBACK');
    expect(db.prepare("SELECT name FROM sqlite_schema WHERE name='lessons_old'").all()).toEqual([]);
  } finally { db.close(); }
});

// Explicit opt-in is used only to publish a proven candidate during development.
// Normal test runs never write the migration or any validation output.
afterAll(suite => {
  expect(blockedFetch).not.toHaveBeenCalled();
  if (process.env.MIGRATION_REPAIR_PUBLISH !== '1') return;
  const passed = (task: typeof suite): boolean => task.type === 'suite'
    ? task.tasks.every(child => passed(child as typeof suite)) : task.result?.state === 'pass';
  if (!passed(suite)) throw new Error('Refusing to publish an unproven migration');
  if (!published) writeFileSync(migrationPath, candidateSql, { flag: 'wx' });
  console.log(JSON.stringify({ migrationRepairProof: { tests: 2 + 2 * (13 + drifts.length),
    historicalSha256: historical.map(file => ({ name: file.name, sha256: createHash('sha256').update(file.sql).digest('hex') })),
    candidateSha256: createHash('sha256').update(candidateSql).digest('hex'),
    rows: 31, populatedTables: 25, repairedForeignKeys: 3, namedIndices: 11 } }));
});
