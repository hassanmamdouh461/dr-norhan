from pathlib import Path
import difflib
import html
import json
import zipfile

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'outputs'
BACKUP = ROOT / '.workbuddy-ai/dev-backups/2026-09-15-parallel-development'
summary = json.loads((OUT / 'validation/summary.json').read_text(encoding='utf-8'))
changed = []
for tree in ['backend/src', 'dashboard/src', 'student-web/src', 'student_app/lib', 'student_app/test']:
    for path in sorted((ROOT / tree).rglob('*')):
        if path.is_file():
            relative = path.relative_to(ROOT)
            old = BACKUP / relative
            if not old.exists() or old.read_bytes() != path.read_bytes():
                changed.append((path, old, relative.as_posix()))
for name in ['student-web/lesson-player-generation.worker-regression.cjs', 'scripts/validate_parallel_changes.cjs']:
    changed.append((ROOT / name, BACKUP / name, name))
manifest = []
patch_parts = []
for current, old, relative in changed:
    before = old.read_text(encoding='utf-8').splitlines(keepends=True) if old.exists() else []
    after = current.read_text(encoding='utf-8').splitlines(keepends=True)
    patch_parts.extend(difflib.unified_diff(before, after, fromfile='a/' + relative if old.exists() else '/dev/null', tofile='b/' + relative))
    manifest.append({'path': relative, 'change': 'modified' if old.exists() else 'added', 'bytes': current.stat().st_size})
(OUT / 'source-changes.patch').write_text(''.join(patch_parts), encoding='utf-8')
(OUT / 'change-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
with zipfile.ZipFile(OUT / 'source-changes.zip', 'w', zipfile.ZIP_DEFLATED) as bundle:
    for path, _, relative in changed:
        bundle.write(path, 'source/' + relative)
    bundle.write(OUT / 'source-changes.patch', 'source-changes.patch')
    bundle.write(OUT / 'change-manifest.json', 'change-manifest.json')
    bundle.write(OUT / 'validation/summary.json', 'validation-summary.json')

esc = html.escape
changes = {
    'Backend': [
        'New web device registrations no longer auto-approve themselves; existing trust is preserved. Native auto-trust remains a separate open risk.',
        'Removed hardcoded playback signing fallbacks. Missing or blank SUPABASE_JWT_SECRET now fails closed; authentication denial responses are propagated correctly.',
        'Teacher course trees retain unpublished units and lessons. Student and guest publication restrictions remain intact.',
        'Completion numerators now use the same eligible lessons as denominators, preventing progress above 100%.',
        'Video replacement is atomic and validates the database-compatible status enum. Failed replacement preserves prior video records.',
        'Assistant permission updates and deletion enforce target role and platform inside their writes.',
        'Grade sheets exclude unfinished attempts without hiding genuine submitted zero grades.',
        'Existing integration suites now run with synthetic JWT fixtures and blocked outbound calls.'
    ],
    'Teacher dashboard': [
        'Course mutations refresh their target without collapsing the expanded course; stale requests cannot replace newer contents.',
        'Course Save is disabled during upload/submission, with immediate duplicate-request guards and errors visible inside the form.',
        'Exam schedules correctly round-trip local inputs and UTC timestamps; untouched timestamps retain exact precision. Selecting an exam does not autosave.',
        'Exam saves are serialized per selection, reconcile shared data after navigation, preserve created IDs after refresh failure, and resume newer queued drafts after failures.',
        'Pending exam saves prevent reopening the same exam until confirmed, avoiding stale-editor overwrites while other exams remain usable.',
        'Question history/replies are selection-scoped; accepted replies remain visible without clearing a newer draft.',
        'Mobile drawer opens from the correct RTL edge.'
    ],
    'Student website': [
        'Timed exams and homework distinguish started attempts from submitted results. Draft attempts remain answerable with their countdown.',
        'Exam answer restoration validates stored maps; storage failures are handled, and synchronous submission locks prevent duplicate manual/timeout sends.',
        'Course activation refreshes cached exams as well as courses.',
        'Lesson initialization and deferred media callbacks are generation-scoped, preventing an old request from replacing a newly selected lesson.',
        'Resume position is captured before HLS teardown resets media time.',
        'Homework remains mounted after first opening so tab switching preserves drafts; failed initial loads have an explicit retry action.',
        'Stacked dialogs isolate background content, contain keyboard focus, close only the top dialog, and reveal focused controls during keyboard navigation.'
    ],
    'Flutter app — source reviewed, runtime unverified': [
        'Optional Firebase failure no longer unconditionally initializes the token-refresh subscription.',
        'Course redemption owns and dismisses its exact root loading dialog instead of popping the course route.',
        'PDF loading checks widget lifetime and cancels active downloads when disposed.',
        'Own-origin requests send the required AJAX marker; third-party requests do not receive API headers. Added authenticated isolation scenarios.',
        'Removed an unsupported Dio Options.connectTimeout argument while preserving the request receive timeout.',
        '38 regression cases are authored, but none were executed because Flutter and Dart are unavailable.'
    ]
}
sections = ''.join('<section class="card"><h2>' + esc(title) + '</h2><ul>' + ''.join('<li>' + esc(line) + '</li>' for line in lines) + '</ul></section>' for title, lines in changes.items())
rows = ''
labels = {'backend-types':'Backend TypeScript', 'dashboard-types':'Dashboard TypeScript', 'student-web-types':'Student website TypeScript', 'backend-tests':'Backend regression/integration suite', 'dashboard-regressions':'Dashboard offline regressions', 'student-web-regressions':'Student website offline regressions', 'dashboard-build':'Dashboard production export', 'student-web-build':'Student website production build'}
for result in summary['results']:
    passed = result['status'] == 'passed'
    detail = str(result['passedTests']) + ' tests passed' if result.get('passedTests') else ('Passed' if passed else 'Compiled; 15 pages generated; final export blocked')
    link = result.get('log')
    label = esc(labels.get(result['id'], result['id']))
    if link:
        label = '<a href="' + esc(link.removeprefix('outputs/'), quote=True) + '">' + label + '</a>'
    rows += '<tr><td>' + label + '</td><td><span class="pill ' + ('ok' if passed else 'warn') + '">' + esc(detail) + '</span></td></tr>'
rows += '<tr><td>Flutter tests, analyzer and mobile build</td><td><span class="pill warn">Not run — SDK unavailable; 38 cases authored</span></td></tr>'
files_html = ''.join('<tr data-file="' + esc(item['path'].lower(), quote=True) + '"><td><code>' + esc(item['path']) + '</code></td><td>' + item['change'] + '</td></tr>' for item in manifest)
risks = [
    ('Release blocker: dashboard export', 'Compilation and all 15 static pages succeeded in a fresh staging checkout. Next.js final cleanup is blocked by SAFE_DELETE_BULK_CONFIRM_REQUIRED. The guard was not disabled, and no final dashboard out export was produced. Approve the environment cleanup prompt before retrying.'),
    ('Release blocker: mobile validation', 'Provide Flutter >=3.22.0 and Dart >=3.4.0 consistent with the lockfile, then run flutter test --no-pub and flutter analyze. No APK or iOS artifact was rebuilt; app-release.apk is unchanged.'),
    ('Configuration requirement', 'Set a strong, nonblank SUPABASE_JWT_SECRET through the existing secret-management process before using playback JWTs. Missing configuration now intentionally returns 503 rather than signing with a known fallback. No secret was created, read for reporting, or changed.'),
    ('Remaining device-trust weakness', 'Native auto-trust still relies on client-provided platform information. The web registration fix does not make the wider device-trust model tamper-proof. Verifiable native enrollment/attestation and concurrency-safe device limits need a separate design.'),
    ('Remaining redemption consistency risk', 'Code consumption and enrollment still commit separately. Existing rollback tests pass, but interruption and concurrent-redemption cases remain uncovered risks. A coordinated atomic/idempotent redemption design is required; no production data or schema was changed.'),
    ('Migration review required', 'Static audit flagged parent-table rename/drop behavior in migration 0009 as a potential foreign-key integrity issue. Current local migration suites passed; populated production-like migration and foreign_key_check validation remain necessary. The migration was not rewritten or remotely executed.'),
    ('Unimplemented follow-ups', 'Targeted push delivery should include registered subscriptions, not only device tokens. iOS workflows reference a missing native ios project. Dashboard next start conflicts with static export. Upload script working-directory/config anchoring and outdated root README also need follow-up.'),
    ('Validation limits', 'Web regressions use deterministic offline hook/DOM/media doubles, not real browser, screen-reader, or live streaming tests. Existing build warnings include a >500 kB HLS chunk. Cross-tab exam submission idempotency and account-scoped saved answers were not added.')
]
risk_html = ''.join('<details><summary>' + esc(title) + '</summary><p>' + esc(text) + '</p></details>' for title, text in risks)
page = '''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Parallel development — verification report</title>
<style>
:root{color-scheme:dark;--bg:#0c111c;--surface:#131d2e;--edge:#29354a;--fg:#edf3fc;--muted:#a8b8ce;--accent:#8db5ff;--ok:#89dfb7;--warn:#ffd28c}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.65 system-ui,-apple-system,"Segoe UI",sans-serif}main{max-width:1180px;margin:0 auto;padding:48px 28px 64px}header{border-bottom:1px solid var(--edge);padding-bottom:26px}.eyebrow{font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--accent)}h1{font-size:clamp(28px,4vw,44px);line-height:1.18;margin:12px 0}h2{font-size:21px;margin:0 0 16px}h3{font-size:16px}p{color:var(--muted)}a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:26px 0}.stat,.card{background:var(--surface);border:1px solid var(--edge);border-radius:14px;padding:23px}.stat strong{display:block;font-size:30px;color:var(--fg)}.stat span{font-size:13px;color:var(--muted)}.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin:24px 0}.card ul{padding-left:19px;margin:0}.card li{margin:10px 0;color:#c7d4e7}.banner{padding:17px 20px;background:#272215;border:1px solid #68512a;border-radius:10px;color:var(--warn)}table{width:100%;border-collapse:collapse}td,th{padding:13px 10px;border-bottom:1px solid var(--edge);text-align:left;vertical-align:top}th{color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.08em}.pill{padding:5px 10px;border-radius:6px;font-size:12px;display:inline-block}.ok{color:var(--ok);background:#13382e}.warn{color:var(--warn);background:#3a2d1c}code{font-size:12px;overflow-wrap:anywhere;color:#c2d5f5}details{border-bottom:1px solid var(--edge);padding:15px 0}summary{cursor:pointer;font-weight:600}details p{margin:10px 0 0}input{width:100%;padding:12px;background:var(--bg);border:1px solid var(--edge);border-radius:8px;color:var(--fg);margin-bottom:10px}.downloads{display:flex;gap:12px;flex-wrap:wrap;margin:22px 0}.downloads a{padding:10px 15px;border:1px solid var(--edge);border-radius:8px;background:var(--surface)}footer{margin-top:30px;font-size:12px;color:var(--muted)}@media(max-width:760px){main{padding:26px 16px}.grid{grid-template-columns:1fr}.stats{grid-template-columns:1fr 1fr}.card{padding:18px}td{padding:10px 4px}}
</style></head><body><main>
<header><div class="eyebrow">Engineering delivery / 15 September 2026</div><h1>Parallel development,<br>with verified outcomes.</h1><p>Ten parallel audit workstreams, followed by bounded implementation and independent review waves. Changes are applied to the existing project; this report separates completed checks from release blockers.</p></header>
<div class="stats"><div class="stat"><strong>256</strong><span>executed tests passed</span></div><div class="stat"><strong>4</strong><span>application areas improved</span></div><div class="stat"><strong>38</strong><span>source / test / runner files changed</span></div><div class="stat"><strong>2</strong><span>release validation blockers</span></div></div>
<div class="banner"><strong>Not a production release.</strong> The student website builds successfully. Dashboard final export needs cleanup confirmation; Flutter compilation and tests still need the SDK.</div>
<div class="downloads"><a href="source-changes.zip">Download changed source + patch</a><a href="validation/summary.json">Validation summary JSON</a><a href="change-manifest.json">File manifest</a></div>
<section class="card"><h2>Final validation</h2><table><thead><tr><th>Check</th><th>Result</th></tr></thead><tbody>__CHECK_ROWS__</tbody></table><p>163 backend + 32 dashboard + 61 student website = 256 passing tests. Flutter's 38 authored cases are excluded. The validation runner intentionally exits nonzero while dashboard export remains blocked.</p></section>
<div class="grid">__CHANGE_SECTIONS__</div>
<section class="card"><h2>Release gates and remaining work</h2>__RISKS__</section>
<section class="card" style="margin-top:24px"><h2>Exact changed-file inventory</h2><p>22 existing files modified and 16 new source/test/runner files. Package manifests and SQL migrations are unchanged.</p><label for="filter">Filter paths</label><input id="filter" type="search" placeholder="Try backend, exams, Flutter tests..."><table><thead><tr><th>Project-relative path</th><th>Change</th></tr></thead><tbody id="files">__FILES__</tbody></table></section>
<section class="card" style="margin-top:24px"><h2>Safety and reproduction</h2><p>No deployment, production API mutation, dependency installation, or remote database migration was performed. The project root is not a Git repository, so a source snapshot was retained before editing.</p><p><strong>Snapshot:</strong><br><code>.workbuddy-ai/dev-backups/2026-09-15-parallel-development/</code></p><p><strong>Repeat checks using installed tooling:</strong><br><code>"C:/Users/kayf/.workbuddy-ai/binaries/node/versions/22.22.2-2/node.exe" "scripts/validate_parallel_changes.cjs"</code></p><p>The archive contains only the changed project source/tests, runner, patch, manifest and validation summary. It excludes environment files, credentials, dependencies, build directories, and the backup snapshot. Do not blindly overwrite later edits when reapplying it.</p></section>
<footer>Final validation timestamp: __TIME__ · Managed Node __NODE__ · Changes delivered locally, not deployed.</footer>
</main><script>document.getElementById('filter').addEventListener('input',function(){const q=this.value.toLowerCase();document.querySelectorAll('#files tr').forEach(row=>{row.hidden=!row.dataset.file.includes(q)});});</script></body></html>'''
page = page.replace('__CHECK_ROWS__', rows).replace('__CHANGE_SECTIONS__', sections).replace('__RISKS__', risk_html).replace('__FILES__', files_html).replace('__TIME__', esc(summary['generatedAt'])).replace('__NODE__', esc(summary['nodeVersion']))
(OUT / 'development-report.html').write_text(page, encoding='utf-8')
assert len(manifest) == 38, len(manifest)
with zipfile.ZipFile(OUT / 'source-changes.zip') as bundle:
    assert bundle.testzip() is None
    assert not any('/.env' in name or '/node_modules/' in name for name in bundle.namelist())
print(json.dumps({'report': str(OUT / 'development-report.html'), 'archive': str(OUT / 'source-changes.zip'), 'modified': sum(item['change'] == 'modified' for item in manifest), 'added': sum(item['change'] == 'added' for item in manifest), 'passed_tests': summary['passedTests']}, indent=2))
