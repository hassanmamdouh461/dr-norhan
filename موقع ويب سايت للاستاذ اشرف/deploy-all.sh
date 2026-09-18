#!/usr/bin/env bash
# ============================================================
# فُصْحَى — نشر المشاريع الثلاثة على Cloudflare
# ============================================================
# الاستخدام:
#   ./deploy-all.sh              نشر الكل
#   ./deploy-all.sh api          الباكند فقط
#   ./deploy-all.sh web          تطبيق الطالب فقط
#   ./deploy-all.sh dashboard    لوحة التحكم فقط
#
# المتطلبات:
#   export CLOUDFLARE_API_TOKEN=...
#   (أو كن مسجّلاً عبر `wrangler login`)
# ============================================================
set -euo pipefail

ACCOUNT_ID="c4db824a32386eeced69072e0ba22de5"
export CLOUDFLARE_ACCOUNT_ID="$ACCOUNT_ID"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# عنوان الـ API الذي تُبنى به الواجهتان (يُضمَّن وقت البناء، فأي تغيير يلزمه إعادة بناء).
#   - قبل ربط النطاقات: رابط workers.dev الافتراضي (synaptic-gw = اسم حساب Cloudflare الحقيقي).
#   - بعد ربط fusha.site:  API_URL=https://api.fusha.site ./deploy-all.sh
# لا يمكن الاعتماد على الطلبات النسبية هنا لأن الواجهات والـ API على مضيفين مختلفين.
API_URL="${API_URL:-https://fusha-ashraf-api.synaptic-gw.workers.dev}"

TARGET="${1:-all}"

say() { printf '\n\033[1;36m▶ %s\033[0m\n' "$1"; }
ok()  { printf '\033[1;32m   ✓ %s\033[0m\n' "$1"; }
die() { printf '\033[1;31m   ✗ %s\033[0m\n' "$1" >&2; exit 1; }

# ── الباكند ──
deploy_api() {
  say "نشر الباكند (Worker)"
  cd "$ROOT/backend"
  npx tsc --noEmit || die "tsc فشل في الباكند"
  npx wrangler d1 migrations apply fusha_ashraf_db --remote -y \
    || echo "   ⚠ تعذّر تطبيق الهجرات (قد تكون مُطبَّقة مسبقاً)"
  npx wrangler deploy || die "نشر الباكند فشل"
  ok "الباكند: $API_URL"
}

# ── تطبيق الطالب ──
deploy_web() {
  say "نشر تطبيق الطالب (Pages)"
  cd "$ROOT/student-web"
  export VITE_API_URL="$API_URL"
  mv dist "dist_old_$(date +%s)" 2>/dev/null || true
  npx vite build || die "بناء تطبيق الطالب فشل"
  npx wrangler pages deploy dist --project-name fusha-student-web --branch main \
    || die "نشر تطبيق الطالب فشل"
  ok "تطبيق الطالب: https://fusha-student-web.pages.dev"
}

# ── لوحة التحكم ──
deploy_dashboard() {
  say "نشر لوحة التحكم (Pages)"
  cd "$ROOT/dashboard"
  export NEXT_PUBLIC_API_URL="$API_URL"
  # ملاحظة: next build قد يفشل في بعض البيئات بسبب حاجز حذف على `.next`
  # الحل البديل: بناء `out/` يدوياً — انظر docs/22-build-report.md
  mv .next ".next_old_$(date +%s)" 2>/dev/null || true
  mv out "out_old_$(date +%s)" 2>/dev/null || true
  npx next build || die "بناء لوحة التحكم فشل"
  npx wrangler pages deploy out --project-name fusha-dashboard --branch main \
    || die "نشر لوحة التحكم فشل"
  ok "لوحة التحكم: https://fusha-dashboard.pages.dev"
}

case "$TARGET" in
  api)       deploy_api ;;
  web)       deploy_web ;;
  dashboard) deploy_dashboard ;;
  all)       deploy_api; deploy_web; deploy_dashboard ;;
  *)         die "هدف غير معروف: $TARGET (اختر: api | web | dashboard | all)" ;;
esac

printf '\n\033[1;32m✅ النشر اكتمل\033[0m\n'
printf '   عنوان الـ API: %s\n\n' "$API_URL"
