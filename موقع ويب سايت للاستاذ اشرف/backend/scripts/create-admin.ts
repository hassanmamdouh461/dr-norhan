#!/usr/bin/env node
/**
 * إنشاء أول حساب مدير (أو مساعد) — بعد إزالة Supabase لم يعد هناك لوحة خارجية.
 * Create the first admin (or assistant) account directly in D1.
 *
 * يعمل هذا السكربت على Node فقط (لا يحتاج أي حزمة إضافية) ويُنتج نفس بصمة
 * كلمة المرور التي يتحقق منها الـ Worker: PBKDF2-HMAC-SHA256، 100000 تكرار،
 * مفتاح 256 بت، بصيغة `<saltHex>:<hashHex>`.
 *
 * ⚠️ يجب أن يبقى `PBKDF2_ITERATIONS` هنا مطابقاً تماماً لنظيره في
 * `src/lib/password.ts` — أي اختلاف يعني أن كلمة مرور المدير لن تُقبل.
 * السقف على Cloudflare Workers هو 100000 (انظر التعليق في `src/lib/password.ts`).
 *
 * التشغيل (Node 22+ يدعم TypeScript مباشرةً عبر type stripping):
 *
 *   # 1) طباعة أمر SQL فقط (افتراضي — آمن للمراجعة قبل التنفيذ)
 *   node scripts/create-admin.ts --email admin@fusha.site --password "كلمة-مرور-قوية" --name "أشرف سليم"
 *
 *   # 2) تنفيذ مباشر على قاعدة البيانات المحلية
 *   node scripts/create-admin.ts --email admin@fusha.site --password "..." --name "أشرف سليم" --local
 *
 *   # 3) تنفيذ مباشر على قاعدة الإنتاج (D1 عن بُعد)
 *   node scripts/create-admin.ts --email admin@fusha.site --password "..." --name "أشرف سليم" --remote
 *
 * ملاحظة: لا تستخدم `wrangler secret` هنا؛ هذا السكربت يكتب في D1 لا في أسرار الـ Worker.
 */

import { pbkdf2Sync, randomBytes, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// ⚠️ مطابق تماماً لـ PBKDF2_ITERATIONS في src/lib/password.ts
const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_KEY_BYTES = 32;
const PBKDF2_DIGEST = 'sha256';
const SALT_BYTES = 16;
const DB_NAME = 'fusha_ashraf_db';
const PLATFORM = 'fusha';

interface Args {
  email?: string;
  password?: string;
  name?: string;
  phone?: string;
  role?: string;
  local?: boolean;
  remote?: boolean;
  help?: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    switch (token) {
      case '--email': args.email = argv[++i]; break;
      case '--password': args.password = argv[++i]; break;
      case '--name': args.name = argv[++i]; break;
      case '--phone': args.phone = argv[++i]; break;
      case '--role': args.role = argv[++i]; break;
      case '--local': args.local = true; break;
      case '--remote': args.remote = true; break;
      case '-h':
      case '--help': args.help = true; break;
      default:
        if (token.startsWith('--')) {
          throw new Error(`وسيط غير معروف: ${token}`);
        }
    }
  }
  return args;
}

function usage(): void {
  console.log(`
إنشاء حساب مدير/مساعد في D1 — منصة فُصْحَى

  node scripts/create-admin.ts --email <البريد> --password <كلمة المرور> --name <الاسم> [خيارات]

الخيارات:
  --email     <string>   البريد الإلكتروني (مطلوب)
  --password  <string>   كلمة المرور، 8 أحرف على الأقل (مطلوب)
  --name      <string>   الاسم الكامل (مطلوب)
  --phone     <string>   رقم الهاتف (اختياري)
  --role      <string>   admin (افتراضي) أو assistant
  --local                نفّذ الأمر على D1 المحلية عبر wrangler
  --remote               نفّذ الأمر على D1 في Cloudflare عبر wrangler
  -h, --help             عرض هذه الرسالة

بدون --local/--remote يطبع السكربت أمر SQL جاهزاً للمراجعة والتنفيذ اليدوي.
`);
}

function hashPassword(password: string): string {
  const salt = randomBytes(SALT_BYTES);
  const hash = pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEY_BYTES, PBKDF2_DIGEST);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

function sqlString(value: string | null): string {
  if (value === null) return 'NULL';
  return `'${value.replace(/'/g, "''")}'`;
}

function buildSql(args: Required<Pick<Args, 'email' | 'name' | 'role'>> & { phone?: string; password: string }): string {
  const id = randomUUID();
  const passwordHash = hashPassword(args.password);

  // UPSERT على البريد: إن كان الحساب موجوداً نحدّث كلمة المرور والدور بدل الفشل.
  return `INSERT INTO profiles (id, supabase_user_id, email, password_hash, role, full_name, phone, status, max_devices, platform, created_at, updated_at)
VALUES (${sqlString(id)}, ${sqlString(`local-${id}`)}, ${sqlString(args.email)}, ${sqlString(passwordHash)}, ${sqlString(args.role)}, ${sqlString(args.name)}, ${sqlString(args.phone || '')}, 'active', 5, ${sqlString(PLATFORM)}, datetime('now'), datetime('now'))
ON CONFLICT(email) DO UPDATE SET
  password_hash = excluded.password_hash,
  role          = excluded.role,
  full_name     = excluded.full_name,
  phone         = CASE WHEN excluded.phone = '' THEN profiles.phone ELSE excluded.phone END,
  status        = 'active',
  updated_at    = datetime('now');`;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.email || !args.password || !args.name) {
    usage();
    process.exit(args.help ? 0 : 1);
  }

  if (args.password.length < 8) {
    console.error('خطأ: كلمة المرور يجب أن تكون 8 أحرف على الأقل.');
    process.exit(1);
  }

  const role = args.role || 'admin';
  if (role !== 'admin' && role !== 'assistant') {
    console.error("خطأ: --role يجب أن تكون 'admin' أو 'assistant'.");
    process.exit(1);
  }

  const sql = buildSql({
    email: args.email.trim().toLowerCase(),
    password: args.password,
    name: args.name,
    phone: args.phone,
    role,
  });

  if (!args.local && !args.remote) {
    console.log('-- SQL جاهز للتنفيذ --\n');
    console.log(sql);
    console.log('\n-- نفّذه يدوياً بالأمر التالي (أضف --remote للإنتاج) --\n');
    console.log(`npx wrangler d1 execute ${DB_NAME} --local --command "${sql.replace(/"/g, '\\"')}"`);
    return;
  }

  const mode = args.remote ? '--remote' : '--local';
  console.log(`تنفيذ على D1 (${args.remote ? 'remote' : 'local'})...`);
  // ⚠️ لا تستخدم `npx` مع `shell: true` على Windows: مسار المشروع يحتوي مسافات،
  // فيُعاد تقسيم الـ SQL عند الفراغات ويُنفَّذ wrangler بدون `--command`،
  // فتُقرأ جملة INSERT كمعاملات موضعية (خطأ "Unknown arguments: INTO, profiles…").
  // الحل: ننادي ملف wrangler مباشرةً بـ execFileSync وبدون shell، فلا يوجد تقسيم.
  // يُفترض تشغيل السكربت من مجلد `backend` (كما في التوثيق).
  const wranglerBin = resolve(process.cwd(), 'node_modules', 'wrangler', 'bin', 'wrangler.js');
  if (!existsSync(wranglerBin)) {
    console.error(
      `تعذّر العثور على wrangler: ${wranglerBin}\n` +
      `نفّذ السكربت من مجلد backend:  node scripts/create-admin.ts ...`
    );
    process.exit(1);
  }
  execFileSync(process.execPath, [wranglerBin, 'd1', 'execute', DB_NAME, mode, '--command', sql], {
    stdio: 'inherit',
    shell: false,
  });
  console.log(`\nتم. يمكن الآن تسجيل الدخول بـ ${args.email} عبر POST /auth/login.`);
}

main();
