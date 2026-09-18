import { afterAll, describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { URL } from 'node:url';
import type { DatabaseSync as SQLiteDatabase } from 'node:sqlite';
import { Miniflare } from 'miniflare';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const migrationPath = new URL('../../migrations/0025_drop_dangling_fks.sql', import.meta.url);
// The repair is proven against the ENTIRE published schema, not just the
// migrations that introduced the bug. Migrations 0018–0024 added columns
// (quizzes.price, quizzes.is_custom, quiz_questions.explanation) and three more
// tables that reference quizzes; a candidate built from a 0016-era snapshot
// would silently drop all of them.
const historical = readdirSync(new URL('../../migrations/', import.meta.url))
  .filter(name => /^\d{4}_.*\.sql$/.test(name) && name.slice(0, 4) < '0025').sort()
  .map(name => ({ name, sql: readFileSync(new URL(`../../migrations/${name}`, import.meta.url), 'utf8') }));
// lesson_progress and lecture_playback_logs dangle only at lessons_old, so their
// rebuild is a plain three-step swap. quizzes dangles too, but five tables
// reference quizzes(id) — DROP TABLE quizzes fires their ON DELETE CASCADE /
// SET NULL actions even with deferred enforcement, so they must be copied into
// shadows and dropped first. Verified exhaustive: no table outside `targets`
// references any member of `targets`, which the candidate's guard enforces.
const dangling = ['lesson_progress', 'lecture_playback_logs'];
const quizChildren = ['quiz_questions', 'quiz_attempts', 'exam_questions', 'purchase_requests', 'exam_build_requests'];
const targets = ['quizzes', ...dangling, ...quizChildren];
// quizzes is created and RENAMED first so SQLite rewrites the shadow child
// references; children are dropped before it so CASCADE cannot erase copied rows.
const creationOrder = [...targets];
const dropOrder = [...creationOrder].reverse();
// The column whose FK each target must keep enforcing after the rebuild.
const orphanColumn: Record<string, string> = {
  lesson_progress: 'lesson_id', lecture_playback_logs: 'lesson_id', quizzes: 'lesson_id',
  quiz_questions: 'quiz_id', quiz_attempts: 'quiz_id', exam_questions: 'quiz_id',
  purchase_requests: 'exam_id', exam_build_requests: 'generated_quiz_id',
};
// Suffix for the shadow tables built during the rebuild. Must match the migration
// number so a half-applied repair can never collide with a published name.
const SHADOW = '__0025';
const shadowName = (table: string) => `${table}${SHADOW}`;
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
  '0018': [
    "INSERT INTO question_bank(id,question_text,options_json,correct_answer_json) VALUES ('bank-question','Synthetic bank question','[\"A\",\"B\"]','{\"option_index\":0}')",
    "INSERT INTO exam_questions(id,quiz_id,question_id,sort_order) VALUES ('exam-question','quiz','bank-question',1)",
  ],
  '0023': [
    // Columns added by 0023 to the tables being rebuilt. If the repair were built
    // from a pre-0018 snapshot these would be dropped and the drift tests would
    // only catch it because these rows carry non-default values.
    'UPDATE quizzes SET price=25, is_custom=1',
    "UPDATE quiz_questions SET explanation='Synthetic explanation' WHERE id='quiz-question'",
    "INSERT INTO purchase_requests(id,platform,student_id,target_type,exam_id,amount,status) VALUES ('purchase','fusha','student','exam','quiz',25,'pending')",
    "INSERT INTO exam_build_requests(id,platform,student_id,title,duration_minutes,question_count,price,generated_quiz_id) VALUES ('build','fusha','student','Synthetic build',60,10,15,'quiz')",
  ],
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
  const reserved = ['lessons_old', ...targets.map(shadowName)].map(quote).join(',');
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
THEN 1 ELSE json('0025 rejected: unexpected schema, dependency, reserved name, or disabled foreign keys') END AS repair_preflight;`;
  const check = (phase: string) => `SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM pragma_foreign_key_check)
THEN 1 ELSE json('0025 rejected: orphan records ${phase}') END AS repair_integrity;`;
  const statements = [
    '-- Drop the stale lessons_old foreign keys from lesson_progress,',
    '-- lecture_playback_logs and quizzes, and preserve every table that',
    '-- references quizzes so DROP cannot cascade or null their rows.',
    '-- The migration runner MUST own one transaction covering this entire file.',
    `-- Fail closed on drift. No existing lessons_old or ${SHADOW} object is accepted.`,
    'PRAGMA defer_foreign_keys=ON;', guard,
    '-- A normal, short-lived parent makes dropping the broken original tables safe.',
    'CREATE TABLE lessons_old (id TEXT PRIMARY KEY);',
    'INSERT INTO lessons_old (id) SELECT id FROM lessons;',
    check('before repair'),
    ...creationOrder.map(table => {
      let sql = expectedSchema.find(row => row.type === 'table' && row.name === table)!.sql!;
      sql = cleanSql(sql).replace(`CREATE TABLE ${table} (`, `CREATE TABLE ${shadowName(table)} (`)
        .replace('REFERENCES "lessons_old"(id)', 'REFERENCES lessons(id)');
      // Every child of quizzes is copied into a shadow that outlives the original.
      // Without this, DROP TABLE quizzes cascades / SET NULLs the rows just copied.
      if (table !== 'quizzes') sql = sql.split('REFERENCES quizzes(id)').join(`REFERENCES ${shadowName('quizzes')}(id)`);
      return `${sql};`;
    }),
    ...creationOrder.map(table => {
      const list = ['rowid', ...columns[table]].map(identifier).join(', ');
      return `INSERT INTO ${shadowName(table)} (${list}) SELECT ${list} FROM ${table};`;
    }),
    '-- Drop the original quiz children first so CASCADE cannot erase their copied rows.',
    ...dropOrder.map(table => `DROP TABLE ${table};`),
    '-- Rename the quiz parent first; SQLite rewrites every shadow child reference.',
    ...creationOrder.map(table => `ALTER TABLE ${shadowName(table)} RENAME TO ${table};`),
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
  // PRAGMA foreign_key_check emits rows in internal schema-iteration order, which
  // D1 does not preserve across a rolled-back DDL batch. Compare the set, not the
  // sequence: the rows themselves are identical either way.
  const violations = (await db.query('PRAGMA foreign_key_check'))
    .map(row => ({ ...row }))
    .sort((a, b) => String(a.table).localeCompare(String(b.table))
      || Number(a.rowid) - Number(b.rowid) || Number(a.fkid) - Number(b.fkid));
  return { schema, rows, definitions, violations };
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
  ['existing shadow table', { after: `CREATE TABLE quizzes${SHADOW}(id TEXT PRIMARY KEY); INSERT INTO quizzes${SHADOW} VALUES ('keep')` }],
];

it('pins the complete historical replay and exact published candidate', () => {
  expect(historical).toHaveLength(24);
  expect(namedIndices).toHaveLength(17);
  expect(repairSql).toBe(candidateSql);
  expect(repairSql).not.toMatch(/\bBEGIN\b|PRAGMA\s+foreign_keys\s*=\s*OFF|ALTER TABLE lessons RENAME/i);
  expect(statements[0]).toBe('PRAGMA defer_foreign_keys=ON');
  expect(targets).toHaveLength(1 + dangling.length + quizChildren.length);
  for (const child of quizChildren) {
    expect(targets).toContain(child);
    expect(statements.find(sql => sql.startsWith(`CREATE TABLE ${shadowName(child)}`))).toContain(`REFERENCES ${shadowName('quizzes')}(id)`);
  }
});

for (const engine of ['SQLite', 'Miniflare D1']) describe(engine, () => {
  it('preserves all 44 rows in 31 populated tables, exact columns, all indices, and FK actions', async () => {
    await withDatabase(engine, {}, async db => {
      const before = await snapshot(db);
      expect(Object.values(before.rows).flat()).toHaveLength(44);
      expect(Object.values(before.rows).filter(rows => rows.length)).toHaveLength(31);
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
        "INSERT INTO exam_questions(id,quiz_id,question_id) VALUES ('fresh-exam-question','fresh-quiz','bank-question')",
        "INSERT INTO purchase_requests(id,student_id,target_type,exam_id) VALUES ('fresh-purchase','student','exam','fresh-quiz')",
        "INSERT INTO exam_build_requests(id,student_id,title,duration_minutes,question_count,generated_quiz_id) VALUES ('fresh-build','student','Fresh build',30,5,'fresh-quiz')",
      ]);
      const before = await snapshot(db);
      for (const sql of [
        "UPDATE lesson_progress SET lesson_id='missing' WHERE id='fresh-progress'",
        "UPDATE lecture_playback_logs SET lesson_id='missing' WHERE id='fresh-log'",
        "UPDATE quizzes SET lesson_id='missing' WHERE id='fresh-quiz'",
        "UPDATE quiz_questions SET quiz_id='missing' WHERE id='fresh-question'",
        "UPDATE quiz_attempts SET quiz_id='missing' WHERE id='fresh-attempt'",
        "UPDATE exam_questions SET quiz_id='missing' WHERE id='fresh-exam-question'",
        "UPDATE purchase_requests SET exam_id='missing' WHERE id='fresh-purchase'",
        "UPDATE exam_build_requests SET generated_quiz_id='missing' WHERE id='fresh-build'",
        "UPDATE purchase_requests SET target_type='invalid' WHERE id='fresh-purchase'",
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

  it('preserves NO ACTION, CASCADE, SET NULL, and every quiz child cascade', async () => {
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
      expect(await db.query("SELECT * FROM exam_questions WHERE quiz_id='quiz'")).toEqual([]);
      expect(await db.query("SELECT exam_id FROM purchase_requests WHERE id='purchase'")).toEqual([{ exam_id: null }]);
      expect(await db.query("SELECT generated_quiz_id FROM exam_build_requests WHERE id='build'")).toEqual([{ generated_quiz_id: null }]);
      expect(await db.query("SELECT id FROM quiz_questions WHERE quiz_id='unlinked'")).toEqual([{ id: 'control-question' }]);
      expect(await db.query('PRAGMA foreign_key_check')).toEqual([]);
    });
  }, 30000);

  for (const marker of [
    `INSERT INTO quiz_attempts${SHADOW}`, `INSERT INTO exam_build_requests${SHADOW}`,
    'DROP TABLE lecture_playback_logs', 'DROP TABLE exam_build_requests',
    `ALTER TABLE quiz_attempts${SHADOW}`, 'CREATE INDEX idx_quizzes_lesson', 'DROP TABLE lessons_old',
  ]) {
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
    const column = orphanColumn[table];
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
    rows: 44, populatedTables: 31, repairedForeignKeys: 3, rebuiltTables: targets.length, namedIndices: namedIndices.length } }));
});
