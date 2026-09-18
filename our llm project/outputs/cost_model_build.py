# -*- coding: utf-8 -*-
"""
نموذج تكلفة التشغيل السنوية لمنصة الأستاذ أشرف (Alhadaba Chemistry)
Bunny Stream (ترميز) -> Cloudflare R2 (تخزين/بث) + Workers/D1/KV/Queues/Pages
بدون Cloudflare Stream
"""
import json

# ══════════════════════════════════════════════════════════════
# 1) الافتراضات (المدخلات)
# ══════════════════════════════════════════════════════════════
A = {}
A['weeks'] = 48                 # أسابيع النشر في السنة
A['lec_per_week'] = 4           # محاضرات/أسبوع
A['hours_per_lec'] = 2          # ساعات/محاضرة
A['students'] = 2000            # طالب نشط
A['watch_h'] = 12               # ساعات مشاهدة/طالب/شهر
A['avg_hold_months'] = 6        # متوسط مدة بقاء الفيديو (تراكم ثم حذف بنهاية السنة)
A['gb_per_hour'] = 3.75         # حجم كل الجودات معاً (GB/ساعة)
A['bitrate_720'] = 2.5          # Mbps لمشاهدة الطالب الافتراضية
A['seg_seconds'] = 5            # طول شريحة HLS
A['cache_hit'] = 0.85           # نسبة القراءات من كاش الحافة

# الأسعار (USD) — من صفحات التسعير الرسمية، سبتمبر 2026
P = {}
P['workers_paid'] = 5.00        # $/شهر (تشمل 10M طلب + 30M CPU-ms)
P['workers_req_over'] = 0.30    # $/مليون طلب إضافي
P['r2_storage'] = 0.015         # $/GB-شهر (Standard)
P['r2_ia_storage'] = 0.010      # $/GB-شهر (Infrequent Access)
P['r2_classA'] = 4.50           # $/مليون عملية كتابة
P['r2_classB'] = 0.36           # $/مليون عملية قراءة
P['r2_free_gb'] = 10            # GB مجاناً/شهر
P['r2_free_A'] = 1_000_000      # عملية كتابة مجاناً/شهر
P['r2_free_B'] = 10_000_000     # عملية قراءة مجاناً/شهر
P['d1_storage'] = 0.75          # $/GB-شهر بعد 5GB
P['d1_free_gb'] = 5
P['kv_reads'] = 0.50            # $/مليون بعد 10M
P['kv_writes'] = 5.00           # $/مليون بعد 1M
P['queues'] = 0.40              # $/مليون عملية بعد 1M
P['images_uniq'] = 0.50         # $/1000 تحويلة فريدة بعد 5000
P['bunny_storage'] = 0.01       # $/GB-شهر
P['bunny_deliv_eu'] = 0.010     # $/GB (Europe & North America)
P['bunny_deliv_mea'] = 0.060    # $/GB (Middle East & Africa)
P['bunny_deliv_vol'] = 0.005    # $/GB (Volume tier)
P['bunny_min_month'] = 1.00     # حد أدنى استهلاك شهري
P['stream_storage'] = 5.00      # $/شهر لكل 1000 دقيقة مخزنة
P['stream_deliv'] = 1.00        # $/1000 دقيقة مُسلَّمة
P['domain'] = 15.00             # تجديد النطاق/سنة
P['play_fee'] = 25.00           # Google Play (مرة واحدة)
P['apple_fee'] = 99.00          # Apple Developer (اختياري/سنة)
P['supabase_pro'] = 25.00       # $/شهر (اختياري)

# ══════════════════════════════════════════════════════════════
# 2) الحسابات
# ══════════════════════════════════════════════════════════════
R = {}
R['lectures_year'] = A['weeks'] * A['lec_per_week']
R['hours_year'] = R['lectures_year'] * A['hours_per_lec']
R['minutes_year'] = R['hours_year'] * 60
R['gb_per_lec'] = A['gb_per_hour'] * A['hours_per_lec']
R['gb_year'] = R['lectures_year'] * R['gb_per_lec']
R['tb_year'] = R['gb_year'] / 1000
R['gb_month_added'] = R['gb_year'] / 12
R['peak_tb'] = R['gb_year'] / 1000

# كائنات R2: شرائح + قوائم تشغيل
segs_per_hour = 3600 / A['seg_seconds']                 # 720
R['segs_per_lec'] = segs_per_hour * A['hours_per_lec'] * 4  # 3 جودات + مسار صوت
R['objects_year'] = R['lectures_year'] * (R['segs_per_lec'] + 8)

# تخزين R2 (تراكم ثم حذف بنهاية السنة)
monthly_storage = []
cum = 0.0
for m in range(1, 13):
    avg = cum + R['gb_month_added'] / 2
    cost = max(0.0, avg - P['r2_free_gb']) * P['r2_storage']
    monthly_storage.append(round(cost, 2))
    cum += R['gb_month_added']
R['monthly_storage'] = monthly_storage
R['r2_storage_year'] = round(sum(monthly_storage), 2)

# عمليات R2
classA_year = R['objects_year']
classA_month = classA_year / 12
R['r2_classA_year'] = round(max(0, classA_month - P['r2_free_A']) / 1e6 * P['r2_classA'] * 12, 2)

reads_month = A['students'] * A['watch_h'] * segs_per_hour
reads_billed = reads_month * (1 - A['cache_hit'])
R['r2_reads_month'] = int(reads_month)
R['r2_classB_year'] = round(max(0, reads_billed - P['r2_free_B']) / 1e6 * P['r2_classB'] * 12, 2)

# حجم التوصيل (الخارج مجاني على R2)
R['gb_delivered_month'] = A['students'] * A['watch_h'] * (A['bitrate_720'] / 8 * 3600 / 1000)
R['tb_delivered_year'] = round(R['gb_delivered_month'] * 12 / 1000, 1)

# Workers: طلبات
heartbeats = A['students'] * A['watch_h'] * 60          # نبضة كل ~60 ثانية
sessions = A['students'] * 20 * 6                        # جلسات/شهر × طلبات
misc = A['students'] * 30
R['workers_req_month'] = int(heartbeats + sessions + misc)
R['workers_over_year'] = round(
    max(0, R['workers_req_month'] - 10_000_000) / 1e6 * P['workers_req_over'] * 12, 2)
R['workers_year'] = round(P['workers_paid'] * 12 + R['workers_over_year'], 2)

# Bunny
R['bunny_deliv_gb'] = round(R['gb_year'] * 1.05, 1)     # 5% إعادة محاولات
R['bunny_deliv_eu'] = round(R['bunny_deliv_gb'] * P['bunny_deliv_eu'], 2)
R['bunny_deliv_mea'] = round(R['bunny_deliv_gb'] * P['bunny_deliv_mea'], 2)
R['bunny_deliv_vol'] = round(R['bunny_deliv_gb'] * P['bunny_deliv_vol'], 2)
R['bunny_storage_year'] = round(R['gb_year'] * 1.5 * (2 / 30) * P['bunny_storage'], 2)  # أصل+مُرمَّز ~يومين
R['bunny_year'] = round(max(P['bunny_min_month'] * 12,
                            R['bunny_deliv_eu'] + R['bunny_storage_year']), 2)

# ══════════════════════════════════════════════════════════════
# 3) جدول التكاليف السنوي
# ══════════════════════════════════════════════════════════════
items = [
    ("Cloudflare Workers (الباقة المدفوعة — 10M طلب + 30M CPU-ms شهرياً)", R['workers_year'], "أساسي"),
    ("Cloudflare R2 — تخزين شرائح الفيديو HLS", R['r2_storage_year'], "أساسي"),
    ("Cloudflare R2 — عمليات Class A (كتابة الشرائح)", R['r2_classA_year'], "أساسي"),
    ("Cloudflare R2 — عمليات Class B (قراءة الشرائح)", R['r2_classB_year'], "أساسي"),
    ("Cloudflare D1 — قاعدة البيانات (ضمن الباقة المدفوعة)", 0.0, "أساسي"),
    ("Cloudflare KV — مفاتيح التشفير وتتبّع النقل", 0.0, "أساسي"),
    ("Cloudflare Queues — طابور نقل الفيديو", 0.0, "أساسي"),
    ("Cloudflare Pages — لوحة المدرس + ويب الطلاب", 0.0, "أساسي"),
    ("Cloudflare Images — تحويل صور الأغلفة", 0.0, "أساسي"),
    ("Bunny Stream — الترميز القياسي (مجاني حتى 1080p)", 0.0, "أساسي"),
    ("Bunny Stream — سحب الشرائح + تخزين مؤقت", R['bunny_year'], "أساسي"),
    ("Supabase Auth — المصادقة (حتى 50 ألف مستخدم نشط)", 0.0, "أساسي"),
    ("Firebase Cloud Messaging — إشعارات Push", 0.0, "أساسي"),
    ("تجديد النطاق السنوي", P['domain'], "أساسي"),
    ("حساب Google Play للمطوّرين (مرة واحدة — السنة الأولى فقط)", P['play_fee'], "لسنة أولى"),
]
R['items'] = items
R['total_year1'] = round(sum(v for _, v, _ in items), 2)
R['total_year2'] = round(R['total_year1'] - P['play_fee'], 2)
R['monthly_avg_y1'] = round(R['total_year1'] / 12, 2)
R['monthly_avg_y2'] = round(R['total_year2'] / 12, 2)
R['cost_per_student'] = round(R['total_year1'] / A['students'], 3)
R['cost_per_lecture_hour'] = round(R['total_year1'] / R['hours_year'], 2)
R['cost_per_tb'] = round(R['total_year1'] / R['tb_delivered_year'], 2)

# ══════════════════════════════════════════════════════════════
# 4) السيناريوهات
# ══════════════════════════════════════════════════════════════
def scenario_storage(hold_months, extra_gb_months=0.0):
    gbm = R['gb_year'] * hold_months + extra_gb_months
    return round(max(0, gbm / 12 - P['r2_free_gb']) * P['r2_storage'] * 12, 2)

fixed = R['total_year1'] - R['r2_storage_year'] - R['bunny_year']

scen = []
# أ) الأساس
scen.append(("الأساس: 2,000 طالب — تراكم سنة ثم حذف", R['total_year1'], R['total_year2']))
# ب) 500 طالب
s500_fixed = fixed
scen.append(("500 طالب فقط (نطاق ضيق)", round(s500_fixed + R['r2_storage_year'] + R['bunny_year'], 2),
             round(s500_fixed + R['r2_storage_year'] + R['bunny_year'] - P['play_fee'], 2)))
# ج) 10,000 طالب
w_over = max(0, R['workers_req_month'] * 5 - 10_000_000) / 1e6 * P['workers_req_over'] * 12
b_reads = max(0, reads_month * 5 * (1 - A['cache_hit']) - P['r2_free_B']) / 1e6 * P['r2_classB'] * 12
s10k = fixed + w_over + b_reads + R['r2_storage_year'] + R['bunny_year']
scen.append(("10,000 طالب (توسّع كبير)", round(s10k, 2), round(s10k - P['play_fee'], 2)))
# د) احتفاظ 12 شهر متحرك
st_roll = scenario_storage(12)
s_roll = fixed + st_roll + R['bunny_year']
scen.append(("احتفاظ متحرك 12 شهراً (حجم مستقر 1.44 TB)", round(s_roll + P['play_fee'], 2), round(s_roll, 2)))
# هـ) أرشيف دائم
st_y2 = scenario_storage(12, R['gb_year'] * 12 * 0 + R['gb_year'] * 6)  # سنة1 كاملة + سنة2 تراكم
s_perm_y2 = fixed + st_y2 + R['bunny_year']
st_y3 = (R['gb_year'] * 24 + R['gb_year'] * 6)
s_perm_y3 = fixed + max(0, st_y3 / 12 - P['r2_free_gb']) * P['r2_storage'] * 12 + R['bunny_year']
scen.append(("أرشيف دائم بلا حذف (سنة 1 / 2 / 3)", R['total_year1'], round(s_perm_y2, 2)))
R['perm_y3'] = round(s_perm_y3, 2)
R['scenarios'] = scen

# و) ترميز Bunny Premium
R['bunny_premium_1080'] = round(R['minutes_year'] * 0.05, 2)
R['bunny_premium_4k'] = round(R['minutes_year'] * 0.15, 2)

# ══════════════════════════════════════════════════════════════
# 5) مقارنة البدائل (Cloudflare Stream / CDN تقليدي)
# ══════════════════════════════════════════════════════════════
minutes_stored_peak = R['minutes_year']
stream_storage_year = (minutes_stored_peak / 1000) * P['stream_storage'] * 6.5  # متوسط السعة المطلوبة
minutes_delivered_year = A['students'] * A['watch_h'] * 60 * 12
stream_deliv_year = minutes_delivered_year / 1000 * P['stream_deliv']
R['stream_storage_year'] = round(stream_storage_year, 2)
R['stream_deliv_year'] = round(stream_deliv_year, 2)
R['stream_total'] = round(stream_storage_year + stream_deliv_year + fixed - R['bunny_year'], 2)

R['traditional_cdn'] = round(R['tb_delivered_year'] * 1000 * 0.05, 2)  # $0.05/GB
R['s3_like'] = round(R['tb_delivered_year'] * 1000 * 0.09, 2)

out = {'assumptions': A, 'prices': P, 'results': R}
print(json.dumps({k: R[k] for k in R if k not in ('items', 'scenarios', 'monthly_storage')},
                 indent=2, ensure_ascii=False, default=str))
print("\nMONTHLY STORAGE:", R['monthly_storage'])
print("\nITEMS:")
for n, v, t in items:
    print(f"  {v:>10.2f}  {n}")
print(f"  TOTAL Y1 = {R['total_year1']}  | Y2 = {R['total_year2']}")
print("\nSCENARIOS:")
for n, y1, y2 in scen:
    print(f"  {n}: Y1={y1} Y2={y2}")
print("\nSTREAM COMPARE:", R['stream_storage_year'], R['stream_deliv_year'], R['stream_total'])

with open('outputs/cost_model_data.json', 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, indent=2, default=str)
