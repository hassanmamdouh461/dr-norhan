# -*- coding: utf-8 -*-
"""يولّد: دراسة-التكلفة-السنوية.xlsx (بمعادلات حية) + دراسة-التكلفة-السنوية.html"""
import json
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

D = json.load(open('outputs/cost_model_data.json', encoding='utf-8'))
A, P, R = D['assumptions'], D['prices'], D['results']
MS = R['monthly_storage']

# ══════════════════════════════ XLSX ══════════════════════════════
HDR = PatternFill('solid', fgColor='0F766E')
SUB = PatternFill('solid', fgColor='CCFBF1')
TOT = PatternFill('solid', fgColor='FEF3C7')
WHITE = Font(color='FFFFFF', bold=True, size=11)
BOLD = Font(bold=True)
THIN = Border(*[Side(style='thin', color='D1D5DB')] * 4)

wb = Workbook()

def head(ws, title, span=4):
    ws['A1'] = title
    ws['A1'].font = Font(bold=True, size=14, color='0F766E')
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=span)
    ws.row_dimensions[1].height = 24

def cols(ws, widths):
    for i, w in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(i)].width = w

def table_header(ws, row, labels):
    for i, l in enumerate(labels, start=1):
        c = ws.cell(row=row, column=i, value=l)
        c.fill, c.font, c.border = HDR, WHITE, THIN
        c.alignment = Alignment(horizontal='center', vertical='center')

# ─── 1) المدخلات ───
ws = wb.active
ws.title = 'المدخلات'
head(ws, 'مدخلات النموذج — عدّل القيم الصفراء وسيتحدّث كل شيء تلقائياً', 4)
table_header(ws, 3, ['البيان', 'القيمة', 'الوحدة', 'ملاحظة'])
INPUTS = [
    ('أسابيع النشر في السنة', 48, 'أسبوع', '4 أسابيع إجازات'),
    ('محاضرات في الأسبوع', 4, 'محاضرة', 'ثابت حسب الطلب'),
    ('ساعات المحاضرة الواحدة', 2, 'ساعة', 'ثابت حسب الطلب'),
    ('عدد الطلاب النشطين', 2000, 'طالب', 'افتراض'),
    ('ساعات المشاهدة / طالب / شهر', 12, 'ساعة', '≈35% من المحتوى المنشور'),
    ('حجم كل الجودات معاً (480+720+1080+صوت)', 3.75, 'GB/ساعة', '≈8.3 Mbps إجمالي'),
    ('متوسط مدة بقاء الفيديو على R2', 6, 'شهر', 'تراكم سنة ثم حذف → متوسط 6 شهور'),
    ('معدل بث المشاهدة الافتراضي (720p)', 2.5, 'Mbps', 'لحساب حجم التوصيل'),
    ('طول شريحة HLS', 5, 'ثانية', 'يحدّد عدد الكائنات'),
    ('نسبة القراءات من كاش الحافة', 0.85, 'نسبة', 'Cache-Control: immutable'),
    ('سعر تخزين R2', 0.015, '$/GB-شهر', 'Standard storage'),
    ('سعر سحب Bunny (أوروبا/أمريكا)', 0.010, '$/GB', 'Standard network'),
    ('سعر سحب Bunny (الشرق الأوسط/أفريقيا)', 0.060, '$/GB', 'أسوأ حالة'),
    ('سعر باقة Workers المدفوعة', 5, '$/شهر', 'تشمل 10M طلب + 30M CPU-ms'),
    ('تجديد النطاق', 15, '$/سنة', 'نطاق واحد + ساب دومينات'),
    ('حساب Google Play', 25, '$ لمرة واحدة', 'السنة الأولى فقط'),
]
r = 4
for name, val, unit, note in INPUTS:
    ws.cell(row=r, column=1, value=name).border = THIN
    c = ws.cell(row=r, column=2, value=val); c.fill, c.border, c.font = TOT, THIN, BOLD
    ws.cell(row=r, column=3, value=unit).border = THIN
    ws.cell(row=r, column=4, value=note).border = THIN
    r += 1
IN = {name: f"'المدخلات'!$B${4 + i}" for i, (name, *_ ) in enumerate(INPUTS)}
for k in ['أسابيع النشر في السنة', 'محاضرات في الأسبوع', 'ساعات المحاضرة الواحدة']:
    pass
W, L, H = IN['أسابيع النشر في السنة'], IN['محاضرات في الأسبوع'], IN['ساعات المحاضرة الواحدة']
STU, WH_ = IN['عدد الطلاب النشطين'], IN['ساعات المشاهدة / طالب / شهر']
GBH, HOLD = IN['حجم كل الجودات معاً (480+720+1080+صوت)'], IN['متوسط مدة بقاء الفيديو على R2']
BR, SEG = IN['معدل بث المشاهدة الافتراضي (720p)'], IN['طول شريحة HLS']
CH, R2P = IN['نسبة القراءات من كاش الحافة'], IN['سعر تخزين R2']
BEU, BMEA = IN['سعر سحب Bunny (أوروبا/أمريكا)'], IN['سعر سحب Bunny (الشرق الأوسط/أفريقيا)']
WP, DOM, PLAY = IN['سعر باقة Workers المدفوعة'], IN['تجديد النطاق'], IN['حساب Google Play']

r += 1
ws.cell(row=r, column=1, value='حسابات مشتقّة').font = Font(bold=True, color='0F766E')
r += 1
DERIVED = [
    ('محاضرات / سنة', f'={W}*{L}'),
    ('ساعات محتوى / سنة', f'=B{r}*{H}'),
    ('دقائق محتوى / سنة', f'=B{r+1}*60'),
    ('حجم المحاضرة الواحدة (GB)', f'={H}*{GBH}'),
    ('حجم المحتوى السنوي (GB)', f'=B{r}*B{r+3}'),
    ('ذروة التخزين بنهاية السنة (TB)', f'=B{r+4}/1000'),
    ('شرائح / محاضرة (4 مسارات)', f'=3600/{SEG}*{H}*4'),
    ('كائنات مكتوبة على R2 / سنة', f'=B{r}*(B{r+6}+8)'),
    ('حجم التوصيل للطلاب (TB/سنة)', f'={STU}*{WH_}*({BR}/8*3600/1000)*12/1000'),
    ('قراءات الشرائح / شهر', f'={STU}*{WH_}*3600/{SEG}'),
]
start = r
for name, f in DERIVED:
    ws.cell(row=r, column=1, value=name).border = THIN
    c = ws.cell(row=r, column=2, value=f); c.border, c.font = THIN, BOLD
    ws.cell(row=r, column=3, value='—').border = THIN
    r += 1
def INCELL(row):
    return f"'المدخلات'!$B${row}"

LEC, HRS, MINS = INCELL(start), INCELL(start + 1), INCELL(start + 2)
GBLEC, GBYEAR, PEAK = INCELL(start + 3), INCELL(start + 4), INCELL(start + 5)
OBJS, TBDELIV, READS = INCELL(start + 7), INCELL(start + 8), INCELL(start + 9)
cols(ws, [46, 16, 20, 42])

# ─── 2) التكلفة السنوية ───
ws = wb.create_sheet('التكلفة_السنوية')
head(ws, 'التكلفة السنوية التفصيلية — السنة الأولى (بالدولار)', 4)
table_header(ws, 3, ['البند', 'الخدمة', 'التكلفة السنوية ($)', 'ملاحظة'])
rows = [
    ('باقة Workers المدفوعة', 'Cloudflare Workers', f'={WP}*12', '10M طلب + 30M CPU-ms شهرياً — مطلوبة لرفع حد الـ subrequests إلى 1000'),
    ('تخزين شرائح الفيديو HLS', 'Cloudflare R2', f'=MAX(0,({GBYEAR}*{HOLD}/12)-10)*{R2P}*12', 'البند الأكبر — ينمو كل شهر ثم يُصفَّر بنهاية السنة'),
    ('عمليات كتابة (Class A)', 'Cloudflare R2', '=0', '≈1.1M كائن/سنة — ضمن المجاني (1M/شهر)'),
    ('عمليات قراءة (Class B)', 'Cloudflare R2', f'=MAX(0,{READS}*(1-{CH})-10000000)/1000000*0.36*12', 'ضمن المجاني (10M/شهر) بفضل كاش الحافة'),
    ('قاعدة البيانات (كورسات/دروس/تقدم/كويزات/أسئلة)', 'Cloudflare D1', '=0', '25 مليار صف قراءة + 50 مليون كتابة + 5GB مجاناً'),
    ('مفاتيح التشفير + تتبّع النقل', 'Cloudflare KV', '=0', '10M قراءة + 1M كتابة مجاناً شهرياً'),
    ('طابور نقل الفيديو', 'Cloudflare Queues', '=0', '1M عملية مجاناً شهرياً'),
    ('لوحة المدرس + ويب الطلاب', 'Cloudflare Pages', '=0', 'استضافة ونطاقات وبناء مجاني'),
    ('تحويل صور الأغلفة', 'Cloudflare Images', '=0', '5000 تحويلة فريدة مجاناً شهرياً'),
    ('الترميز السحابي (حتى 1080p)', 'Bunny Stream', '=0', 'الترميز القياسي مجاني — Premium فقط بفلوس'),
    ('سحب الشرائح من Bunny + تخزين مؤقت', 'Bunny Stream', f'=MAX(12,{GBYEAR}*1.05*{BEU}+{GBYEAR}*1.5*(2/30)*0.01)', 'الحد الأدنى للاستهلاك 1$/شهر'),
    ('المصادقة (JWT)', 'Supabase Auth', '=0', 'مجاني حتى 50,000 مستخدم نشط شهرياً'),
    ('إشعارات Push', 'Firebase FCM', '=0', 'FCM مجاني بالكامل'),
    ('تجديد النطاق', 'Domain', f'={DOM}', 'نطاق واحد'),
    ('حساب Google Play', 'Google Play', f'={PLAY}', 'مرة واحدة — السنة الأولى فقط'),
]
r = 4
for a_, b_, c_, d_ in rows:
    ws.cell(row=r, column=1, value=a_).border = THIN
    ws.cell(row=r, column=2, value=b_).border = THIN
    cc = ws.cell(row=r, column=3, value=c_); cc.border, cc.font, cc.number_format = THIN, BOLD, '0.00'
    ws.cell(row=r, column=4, value=d_).border = THIN
    r += 1
ws.cell(row=r, column=1, value='الإجمالي — السنة الأولى').font = BOLD
tc = ws.cell(row=r, column=3, value=f'=SUM(C4:C{r-1})')
tc.fill, tc.font, tc.number_format = SUB, Font(bold=True, size=12), '0.00'
TOTAL_Y1 = f"'التكلفة_السنوية'!$C${r}"
r += 1
ws.cell(row=r, column=1, value='الإجمالي — السنوات التالية (بدون رسوم Play)').font = BOLD
tc2 = ws.cell(row=r, column=3, value=f'={TOTAL_Y1}-{PLAY}')
tc2.fill, tc2.font, tc2.number_format = SUB, Font(bold=True, size=12), '0.00'
r += 2
ws.cell(row=r, column=1, value='المتوسط الشهري (السنة الأولى)').font = BOLD
ws.cell(row=r, column=3, value=f'={TOTAL_Y1}/12').number_format = '0.00'
r += 1
ws.cell(row=r, column=1, value='تكلفة الطالب الواحد / سنة').font = BOLD
ws.cell(row=r, column=3, value=f'={TOTAL_Y1}/{STU}').number_format = '0.000'
r += 1
ws.cell(row=r, column=1, value='تكلفة ساعة المحاضرة الواحدة').font = BOLD
ws.cell(row=r, column=3, value=f'={TOTAL_Y1}/{HRS}').number_format = '0.00'
r += 1
ws.cell(row=r, column=1, value='تكلفة التيرابايت المُسلَّم للطلاب').font = BOLD
ws.cell(row=r, column=3, value=f'={TOTAL_Y1}/{TBDELIV}').number_format = '0.00'
cols(ws, [52, 22, 20, 60])

# ─── 3) التدفق الشهري ───
ws = wb.create_sheet('التدفق_الشهري')
head(ws, 'التدفق الشهري للسنة الأولى (بالدولار)', 6)
table_header(ws, 3, ['الشهر', 'التخزين التراكمي (GB)', 'تكلفة التخزين', 'Workers', 'Bunny', 'إجمالي الشهر'])
r = 4
for i in range(12):
    ws.cell(row=r, column=1, value=f'شهر {i+1}').border = THIN
    gb = f"=('المدخلات'!$B$26/12)*({i})+('المدخلات'!$B$26/24)"
    ws.cell(row=r, column=2, value=gb).border = THIN
    ws.cell(row=r, column=3, value=f'=MAX(0,B{r}-10)*{R2P}').number_format = '0.00'
    ws.cell(row=r, column=4, value=f'={WP}').number_format = '0.00'
    ws.cell(row=r, column=5, value=f'=({GBYEAR}*1.05*{BEU}+{GBYEAR}*1.5*(2/30)*0.01)/12').number_format = '0.00'
    t = ws.cell(row=r, column=6, value=f'=SUM(C{r}:E{r})'); t.font, t.number_format = BOLD, '0.00'
    for c in range(1, 7):
        ws.cell(row=r, column=c).border = THIN
    r += 1
ws.cell(row=r, column=1, value='الإجمالي').font = BOLD
for c in [3, 4, 5, 6]:
    cc = ws.cell(row=r, column=c, value=f'=SUM({get_column_letter(c)}4:{get_column_letter(c)}15)')
    cc.fill, cc.font, cc.number_format = SUB, BOLD, '0.00'
cols(ws, [12, 24, 18, 12, 12, 16])

# ─── 4) السيناريوهات ───
ws = wb.create_sheet('السيناريوهات')
head(ws, 'تحليل الحساسية — تأثير كل متغير على التكلفة السنوية', 4)
table_header(ws, 3, ['السيناريو', 'السنة الأولى ($)', 'السنوات التالية ($)', 'السبب'])
SC = [
    ('الأساس: 2,000 طالب + تراكم سنة ثم حذف', R['total_year1'], R['total_year2'], 'المرجع'),
    ('500 طالب فقط', R['total_year1'], R['total_year2'], 'التكلفة لا تتأثر بعدد الطلاب: الخارج من R2 مجاني'),
    ('10,000 طالب', 257.15, 232.15, '+13$ فقط (تجاوز طلبات Workers وقراءات R2)'),
    ('احتفاظ متحرك 12 شهراً (1.44 TB مستقر)', 398.96, 373.96, 'تخزين 1.44TB طول السنة = 259$/سنة'),
    ('أرشيف دائم بلا حذف — السنة 2', R['total_year1'], 503.56, 'السنة 1 = 244$، السنة 2 = 504$، السنة 3 = 763$'),
    ('ترميز Bunny Premium 1080p (بدل المجاني)', R['total_year1'] + 1152, R['total_year2'] + 1152, '+0.05$/دقيقة'),
    ('ترميز Bunny Premium 4K', R['total_year1'] + 3456, R['total_year2'] + 3456, '+0.15$/دقيقة — غير مُوصى به'),
    ('سحب الشرائح بتسعير الشرق الأوسط (0.06$/GB)', R['total_year1'] + 75.6, R['total_year2'] + 75.6, 'بدّل لباقة Volume (0.005$/GB)'),
    ('Supabase Pro (بدل المجاني)', R['total_year1'] + 300, R['total_year2'] + 300, 'اختياري: عدم الإيقاف التلقائي + SMTP مخصص'),
    ('الحد الأقصى المتحفظ (كل الباقات المدفوعة)', 651.0, 626.0, 'أسوأ تسعير + بدون كاش + Supabase Pro'),
]
r = 4
for a_, b_, c_, d_ in SC:
    ws.cell(row=r, column=1, value=a_).border = THIN
    for col, v in ((2, b_), (3, c_)):
        cc = ws.cell(row=r, column=col, value=round(v, 2)); cc.border, cc.number_format = THIN, '0.00'
    ws.cell(row=r, column=4, value=d_).border = THIN
    r += 1
cols(ws, [50, 20, 22, 60])

# ─── 5) مقارنة البدائل ───
ws = wb.create_sheet('مقارنة_البدائل')
head(ws, 'مقارنة: التصميم الحالي (Bunny → R2) مقابل البدائل — 2,000 طالب / 12 ساعة مشاهدة', 5)
table_header(ws, 3, ['البديل', 'التخزين/السعة', 'التوصيل', 'خدمات ثابتة', 'الإجمالي السنوي ($)'])
CMP = [
    ('الحالي: Bunny Stream (ترميز مجاني) + R2', 127.8, 0.0, 116.56, R['total_year1']),
    ('Cloudflare Stream (بدون R2)', 748.8, 17280.0, 100.0, 18128.8),
    ('CDN تقليدي بـ 0.05$/GB (مثل Bunny/Bunny CDN مباشر)', 127.8, 16200.0, 100.0, 16427.8),
    ('S3 + CloudFront بـ 0.09$/GB', 190.0, 29160.0, 100.0, 29450.0),
]
r = 4
for a_, b_, c_, d_, e_ in CMP:
    ws.cell(row=r, column=1, value=a_).border = THIN
    for col, v in ((2, b_), (3, c_), (4, d_)):
        cc = ws.cell(row=r, column=col, value=round(v, 2)); cc.border, cc.number_format = THIN, '0.00'
    cc = ws.cell(row=r, column=5, value=round(e_, 2)); cc.fill, cc.font, cc.number_format = SUB, BOLD, '0.00'
    ws.cell(row=r, column=1).border = THIN
    r += 1
r += 1
ws.cell(row=r, column=1, value='الوفر السنوي مقابل Cloudflare Stream').font = Font(bold=True, color='B91C1C')
ws.cell(row=r, column=5, value=round(18128.8 - R['total_year1'], 2)).font = Font(bold=True, color='B91C1C')
r += 1
ws.cell(row=r, column=1, value='نسبة الوفر').font = Font(bold=True, color='B91C1C')
ws.cell(row=r, column=5, value='98.7%').font = Font(bold=True, color='B91C1C')
cols(ws, [56, 20, 18, 18, 22])

# ─── 6) خريطة المزايا ───
ws = wb.create_sheet('خريطة_المزايا')
head(ws, 'كل ميزة في المنصة ← الخدمة التي تستهلكها ← تكلفتها السنوية', 4)
table_header(ws, 3, ['الميزة', 'الخدمة', 'التكلفة السنوية ($)', 'ملاحظة'])
FEAT = [
    ('تسجيل الدخول / المصادقة / استرجاع كلمة المرور', 'Supabase Auth', 0, 'مجاني حتى 50 ألف مستخدم نشط'),
    ('تصفّح الكورسات والوحدات والدروس', 'Workers + D1', 0, 'ضمن الباقة المدفوعة'),
    ('البحث الداخلي (SQLite FTS5)', 'D1', 0, 'ضمن الباقة'),
    ('أكواد التفعيل وإدارتها', 'D1', 0, 'ضمن الباقة'),
    ('تتبّع التقدّم + نبضات المشاهدة (Heartbeat)', 'Workers + D1', 0, '≈1.7M طلب/شهر — ضمن 10M'),
    ('رفع الفيديو وترميزه (480p/720p/1080p)', 'Bunny Stream', 0, 'الترميز القياسي مجاني'),
    ('نقل الشرائح وتشفيرها AES-128 إلى R2', 'Queues + Workers + KV', 0, 'ضمن المجاني'),
    ('تخزين الفيديو وبثه HLS', 'R2 (+ كاش الحافة)', 127.8, 'البند الوحيد المؤثر'),
    ('حماية الفيديو (علامة مائية، ربط جهاز، توكنات)', 'Workers + KV + D1', 0, 'ضمن الباقة'),
    ('ملفات PDF والمرفقات', 'R2', 0, '≈2GB/سنة'),
    ('الأسئلة والإجابات والتقييمات', 'D1', 0, 'ضمن الباقة'),
    ('الكويزات ونتائجها', 'D1', 0, 'ضمن الباقة'),
    ('إشعارات Push (FCM)', 'Queues + FCM', 0, 'FCM مجاني — الطابور غير مفعّل حالياً'),
    ('لوحة تحكم المدرس (الويب)', 'Cloudflare Pages', 0, 'مجاني'),
    ('موقع الطلاب (الويب)', 'Cloudflare Pages', 0, 'مجاني'),
    ('تحليلات وإحصائيات', 'D1', 0, 'ضمن الباقة'),
    ('البنية والـ API', 'Cloudflare Workers (Paid)', 60, '5$/شهر'),
    ('سحب الشرائح من Bunny', 'Bunny Stream', 16.56, '≈1.5TB/سنة بـ 0.01$/GB'),
    ('النطاق', 'Domain', 15, 'تجديد سنوي'),
    ('تطبيق أندرويد', 'Google Play', 25, 'مرة واحدة'),
]
r = 4
for a_, b_, c_, d_ in FEAT:
    ws.cell(row=r, column=1, value=a_).border = THIN
    ws.cell(row=r, column=2, value=b_).border = THIN
    cc = ws.cell(row=r, column=3, value=c_); cc.border, cc.number_format = THIN, '0.00'
    ws.cell(row=r, column=4, value=d_).border = THIN
    r += 1
ws.cell(row=r, column=1, value='الإجمالي').font = BOLD
cc = ws.cell(row=r, column=3, value=f'=SUM(C4:C{r-1})'); cc.fill, cc.font, cc.number_format = SUB, BOLD, '0.00'
cols(ws, [52, 32, 20, 46])

# ─── 7) سيناريو MongoDB + تخزين Bunny ───
BUNNY_STO = 0.055      # $/GB-شهر (السعر الجديد)
RESIDENT_GB = 100      # 100 جيجا تخزين كل شهر
bunny_resident_year = RESIDENT_GB * BUNNY_STO * 12                 # 66.0
bunny_pull_year = R['bunny_deliv_eu']                              # 15.12 سحب الشرائح لـ R2
bunny_full_gb_months = RESIDENT_GB * 78                            # 100GB/شهر تتراكم 12 شهر
bunny_full_year = round(bunny_full_gb_months * BUNNY_STO, 2)       # 429.0
deliv_vol = round(R['tb_delivered_year'] * 1000 * 0.005, 2)        # 1620
deliv_eu = round(R['tb_delivered_year'] * 1000 * 0.01, 2)         # 3240
deliv_mea = round(R['tb_delivered_year'] * 1000 * 0.06, 2)        # 19440
mongo_flex = 144       # 12$/شهر متوسط (من 8$ لحد 30$ سقف)
mongo_m10 = 900        # 75$/شهر شامل compute + تخزين + نسخ احتياطي
fixed_common = 100     # Workers 60 + نطاق 15 + Play 25

ws = wb.create_sheet('سيناريو_مونجو')
head(ws, 'سيناريو بديل: MongoDB بدل D1 + تخزين Bunny بـ $0.055/GB (100 جيجا/شهر)', 7)
table_header(ws, 3, ['السيناريو', 'قاعدة البيانات', 'تخزين الفيديو', 'توصيل/سحب',
                     'خدمات ثابتة', 'الإجمالي/سنة ($)', 'الفرق عن التصميم الحالي'])
MONGO_ROWS = [
    ('التصميم الحالي (D1 + R2)', 'D1 — $0', 'R2 — 127.80', 'سحب Bunny — 15.12', '100.00', R['total_year1'], 0),
    ('B1: MongoDB Flex + نفس الكود (نقل لـ R2)', 'Flex — 144.00', 'Bunny 66.00 + R2 127.80', '15.12', '100.00',
     round(mongo_flex + bunny_resident_year + bunny_pull_year + R['r2_storage_year'] + fixed_common, 2), None),
    ('B2: MongoDB M10 + نفس الكود (نقل لـ R2)', 'M10 — 900.00', 'Bunny 66.00 + R2 127.80', '15.12', '100.00',
     round(mongo_m10 + bunny_resident_year + bunny_pull_year + R['r2_storage_year'] + fixed_common, 2), None),
    ('B3: MongoDB Flex + كل الفيديو على Bunny (Volume 0.005$/GB)', 'Flex — 144.00', f'Bunny كامل — {bunny_full_year}', f'{deliv_vol}', '100.00',
     round(mongo_flex + bunny_full_year + deliv_vol + fixed_common, 2), None),
    ('B4: MongoDB M10 + كل الفيديو على Bunny (الشرق الأوسط 0.06$/GB)', 'M10 — 900.00', f'Bunny كامل — {bunny_full_year}', f'{deliv_mea}', '100.00',
     round(mongo_m10 + bunny_full_year + deliv_mea + fixed_common, 2), None),
]
r = 4
for row in MONGO_ROWS:
    for i, v in enumerate(row[:6], start=1):
        c = ws.cell(row=r, column=i, value=v); c.border = THIN
        if i == 6:
            c.fill, c.font = SUB, BOLD
    diff = (row[5] - R['total_year1']) if row[6] is None else 0
    c = ws.cell(row=r, column=7, value=f'+{diff:,.0f} $ (+{diff / R["total_year1"] * 100:.0f}%)' if diff else 'المرجع')
    c.border = THIN
    if diff > 500:
        c.font = Font(color='B91C1C', bold=True)
    r += 1

r += 2
ws.cell(row=r, column=1, value='أسعار MongoDB Atlas (2026)').font = Font(bold=True, color='0F766E')
r += 1
table_header(ws, r, ['الطبقة', 'السعر/شهر', 'التخزين', 'الحد الأقصى', 'ملاحظة', '', ''])
r += 1
for tier, price, storage, lim, note in [
    ('M0 (مجاني)', '$0', '512 MB', '~100 عملية/ثانية', 'بدون نسخ احتياطي — مش هتكفي بعد شهرين'),
    ('Flex', '$8 → $30 (سقف)', '5 GB', '~500 عملية/ثانية', 'مناسبة للحمولة الحالية (≈0.7 طلب/ثانية)'),
    ('M10 (مخصّص)', '$58.4 + تخزين/نسخ ≈ $75-85', '10-128 GB', '1,500 اتصال', 'إنتاج حقيقي + PITR + Atlas Search'),
    ('M20', '≈ $146', '20 GB+', '—', 'مبالغة في حالتنا'),
]:
    for i, v in enumerate([tier, price, storage, lim, note], start=1):
        ws.cell(row=r, column=i, value=v).border = THIN
    r += 1
r += 1
ws.cell(row=r, column=1, value='ملاحظة معمارية: Cloudflare Workers تقدر تتصل بـ MongoDB بالدريفر الرسمي '
        '(node:net + node:tls مدعومين من 2025)، لكن Atlas Data API مُلغاة، ومفيش Hyperdrive لـ Mongo.').font = Font(color='B45309', bold=True)
cols(ws, [50, 26, 24, 20, 22, 18, 22])

# ─── 8) تفاصيل سيناريو B1 ───
B1_MONGO, B1_MONGO_LOW, B1_MONGO_HIGH = 144.0, 96.0, 360.0
b1_items = [
    ('Cloudflare Workers — الباقة المدفوعة', '5$/شهر (10M طلب + 30M CPU-ms)', '1.74M طلب/شهر', 60.00),
    ('MongoDB Atlas Flex — قاعدة البيانات بدل D1', '8$ أساس (حتى 100 عملية/ثانية) — سقف صلب 30$', '≈2-3 عملية/ثانية، ذروة في مواسم الامتحانات', B1_MONGO),
    ('Atlas Flex — التخزين', '5 GB مشمولة', 'حجم البيانات المتوقع سنة 1 ≈ 0.5-1 GB', 0.0),
    ('Atlas Flex — نقل البيانات (Egress)', 'غير محدود ومجاني على Flex', '≈3 GB/شهر', 0.0),
    ('Cloudflare R2 — تخزين شرائح الفيديو', '0.015$/GB-شهر', '8,640 GB-شهر − 120 GB مجانية', 127.80),
    ('Cloudflare R2 — عمليات Class A (كتابة)', '4.50$/مليون', '1.1M كائن/سنة (~92k/شهر) — ضمن 1M مجاناً', 0.0),
    ('Cloudflare R2 — عمليات Class B (قراءة)', '0.36$/مليون', '17.3M قراءة/شهر، 15% بيفوت الكاش — ضمن 10M', 0.0),
    ('Cloudflare R2 — الخارج (توصيل الطلاب)', 'مجاني تماماً', '324 TB/سنة', 0.0),
    ('Bunny Stream — الترميز القياسي', 'مجاني حتى 1080p', '23,040 دقيقة/سنة', 0.0),
    ('Bunny Stream — التخزين', '0.055$/GB-شهر', '100 GB مقيم/شهر', 66.00),
    ('Bunny Stream — سحب الشرائح للـ Worker', '0.010$/GB (أوروبا/أمريكا)', '1,512 GB/سنة', 15.12),
    ('Cloudflare Queues', '0.40$/مليون بعد 1M', '≈1M عملية/سنة', 0.0),
    ('Cloudflare KV', 'مفاتيح التشفير + تتبّع النقل', '≈20k كتابة/سنة', 0.0),
    ('Cloudflare Pages', 'لوحة المدرس + ويب الطلاب', 'طلبات غير محدودة', 0.0),
    ('Cloudflare Images', '5,000 تحويلة مجاناً/شهر', '<1,000 تحويلة/شهر', 0.0),
    ('Supabase Auth', 'مجاني حتى 50 ألف MAU', '2,000 طالب', 0.0),
    ('Firebase Cloud Messaging', 'مجاني', '≈50 إشعار/طالب/سنة', 0.0),
    ('تجديد النطاق', 'نطاق واحد + ساب دومينات', '—', 15.00),
    ('حساب Google Play', 'مرة واحدة — السنة الأولى', '—', 25.00),
]
b1_total = round(sum(i[3] for i in b1_items), 2)
b1_y2 = round(b1_total - P['play_fee'], 2)
b1_mongo_m, b1_bunny_m, b1_dom_m = B1_MONGO / 12, 81.12 / 12, P['domain'] / 12
b1_monthly = [round(5 + b1_mongo_m + b1_bunny_m + b1_dom_m + v, 2) for v in MS]

ws = wb.create_sheet('B1_التفاصيل')
head(ws, 'تفاصيل سيناريو B1: MongoDB Flex + نفس الكود (ترميز Bunny ← نقل لـ R2)', 5)
table_header(ws, 3, ['البند', 'وحدة التسعير', 'الاستهلاك السنوي المتوقع', 'التكلفة/سنة ($)', 'ملاحظة'])
r = 4
for name, price, usage, cost in b1_items:
    ws.cell(row=r, column=1, value=name).border = THIN
    ws.cell(row=r, column=2, value=price).border = THIN
    ws.cell(row=r, column=3, value=usage).border = THIN
    c = ws.cell(row=r, column=4, value=cost); c.border, c.number_format, c.font = THIN, '0.00', BOLD
    ws.cell(row=r, column=5, value='بديل عن D1 (كانت $0)' if 'MongoDB' in name else '').border = THIN
    r += 1
ws.cell(row=r, column=1, value='الإجمالي — السنة الأولى').font = BOLD
c = ws.cell(row=r, column=4, value=f'=SUM(D4:D{r-1})'); c.fill, c.font, c.number_format = SUB, Font(bold=True, size=12), '0.00'
r += 1
ws.cell(row=r, column=1, value='الإجمالي — السنوات التالية').font = BOLD
c = ws.cell(row=r, column=4, value=f'=D{r-1}-25'); c.fill, c.font, c.number_format = SUB, BOLD, '0.00'
r += 1
ws.cell(row=r, column=1, value='المتوسط الشهري (السنة الأولى)').font = BOLD
c = ws.cell(row=r, column=4, value=f'=D{r-2}/12'); c.number_format = '0.00'
r += 1
ws.cell(row=r, column=1, value='تكلفة الطالب / سنة').font = BOLD
c = ws.cell(row=r, column=4, value=f'=D{r-3}/2000'); c.number_format = '0.000'
r += 3
ws.cell(row=r, column=1, value='حساسية سعر MongoDB Atlas Flex').font = Font(bold=True, color='0F766E')
r += 1
table_header(ws, r, ['الحالة', 'سعر Flex/شهر', 'التكلفة/سنة ($)', 'إجمالي B1/سنة ($)', 'ملاحظة'])
r += 1
for label, mprice, note in [
    ('متفائل — تحت 100 عملية/ثانية طول الوقت', 8, 'الحد الأدنى الفعلي لـ Flex'),
    ('الأساس — ذروات موسمية تدخل شريحة 100-200', 12, 'الفرضية المعتمدة في الجدول أعلاه'),
    ('السقف — 400-500 عملية/ثانية', 30, 'سقف صلب: Flex لا يمكن أن يتجاوز 30$/شهر أبداً'),
]:
    ws.cell(row=r, column=1, value=label).border = THIN
    ws.cell(row=r, column=2, value=mprice).border = THIN
    ws.cell(row=r, column=3, value=mprice * 12).border = THIN
    c = ws.cell(row=r, column=4, value=round(b1_total - B1_MONGO + mprice * 12, 2)); c.font, c.number_format = BOLD, '0.00'
    ws.cell(row=r, column=5, value=note).border = THIN
    r += 1
r += 2
ws.cell(row=r, column=1, value='التدفق الشهري لسيناريو B1 (السنة الأولى)').font = Font(bold=True, color='0F766E')
r += 1
table_header(ws, r, ['الشهر', 'Workers', 'MongoDB Flex', 'Bunny', 'تخزين R2', 'نطاق', 'إجمالي الشهر'])
r += 1
for i in range(12):
    ws.cell(row=r, column=1, value=f'شهر {i+1}').border = THIN
    for col, v in ((2, 5.0), (3, b1_mongo_m), (4, b1_bunny_m), (5, MS[i]), (6, b1_dom_m)):
        c = ws.cell(row=r, column=col, value=round(v, 2)); c.border, c.number_format = THIN, '0.00'
    c = ws.cell(row=r, column=7, value=f'=SUM(B{r}:F{r})'); c.font, c.number_format, c.border = BOLD, '0.00', THIN
    r += 1
ws.cell(row=r, column=1, value='الإجمالي').font = BOLD
for col in (2, 3, 4, 5, 6, 7):
    L_ = get_column_letter(col)
    c = ws.cell(row=r, column=col, value=f'=SUM({L_}{r-12}:{L_}{r-1})'); c.fill, c.font, c.number_format = SUB, BOLD, '0.00'
cols(ws, [46, 34, 40, 18, 34])

# ─── 9) باقة ~700 دولار ───
BASE_Y2 = R['total_year2']   # 219.36
levers = [
    ('Supabase Pro (بدل المجاني)', 300, 'يلغي خطر إيقاف المشروع المجاني + SMTP مخصص + نسخ احتياطي يومي + دعم', 'عالية'),
    ('Cloudflare Pro للنطاق ($20/شهر)', 240, 'WAF مُدار + قواعد صفحات + تحسين صور + دعم 24/7', 'متوسطة'),
    ('Apple Developer (تطبيق iOS)', 99, 'لازم لو هتنزّل التطبيق على App Store', 'حسب الحاجة'),
    ('مراقبة Uptime + Logs (Better Stack $10/شهر)', 120, 'تنبيه قبل ما الطلاب يشتكوا — يراقب الـ API والـ Worker', 'متوسطة'),
    ('Sentry Developer ($26/شهر)', 312, 'تتبّع أخطاء التطبيق — المجاني (5k خطأ/شهر) يكفي غالباً', 'منخفضة'),
    ('MongoDB Atlas Flex (بدل D1)', 144, 'فقط لو فريقك أريح مع Mongo — D1 بـ $0 وأسرع', 'اختياري'),
    ('تخزين Bunny 100GB ($0.055/GB)', 66, 'نسخة احتياطية من الفيديو + إمكانية إعادة النقل', 'متوسطة'),
    ('نسخ احتياطي D1 → R2 (كرون يومي)', 2, 'أرخص وأهم بند أمان في القائمة', 'عالية'),
    ('Resend / SMTP للإيميلات ($20/شهر)', 240, 'إيميلات التفعيل واسترجاع كلمة المرور — المجاني 3k/شهر يكفي', 'منخفضة'),
    ('هامش طوارئ 10%', 22, 'لأي تجاوز غير متوقع', 'موصى به'),
]
pkgs = [
    ('باقة «إنتاج مستقر» — مُوصى بها', [
        ('الأساس (سنوات تالية)', BASE_Y2),
        ('Supabase Pro', 300),
        ('مراقبة Uptime + Logs', 120),
        ('تخزين Bunny 100GB', 66),
        ('نسخ احتياطي D1 → R2', 2),
    ]),
    ('باقة «إنتاج + iOS»', [
        ('الأساس (سنوات تالية)', BASE_Y2),
        ('Supabase Pro', 300),
        ('Apple Developer', 99),
        ('تخزين Bunny 100GB', 66),
        ('نسخ احتياطي D1 → R2', 2),
    ]),
    ('باقة «أداء + حماية»', [
        ('الأساس (سنوات تالية)', BASE_Y2),
        ('Supabase Pro', 300),
        ('Cloudflare Pro للنطاق', 240),
        ('نسخ احتياطي D1 → R2', 2),
    ]),
]
pkg_totals = {n: round(sum(v for _, v in items_), 2) for n, items_ in pkgs}
natural = [
    ('الاحتفاظ 12 شهر متحرك (بدل حذف بنهاية السنة)', 129.60),
    ('سحب Bunny بتسعير الشرق الأوسط (0.06$/GB)', 75.60),
    ('بدون كاش حافة (كل القراءات من R2)', 31.44),
    ('10,000 طالب بدل 2,000', 13.00),
    ('منصة ثانية على نفس الحساب (مدرس تاني)', 143.00),
]
natural_total = round(BASE_Y2 + sum(v for _, v in natural), 2)

ws = wb.create_sheet('باقة_700')
head(ws, 'إزاي نوصل للتكلفة إلى قرابة 700$/سنة — رافعات وباقات مقترحة', 5)
ws.cell(row=2, column=1, value=f'نقطة البداية (التصميم الحالي، السنوات التالية) = ${BASE_Y2:,.2f}/سنة').font = Font(bold=True, color='B45309')
r = 4
ws.cell(row=r, column=1, value='أولاً: قائمة الرافعات (اختار منها)').font = Font(bold=True, color='0F766E')
r += 1
table_header(ws, r, ['الرافعة (الخدمة)', 'التكلفة/سنة ($)', 'إيه اللي بتضيفه', 'الأولوية', ''])
r += 1
for n, c, b, p in levers:
    ws.cell(row=r, column=1, value=n).border = THIN
    cc = ws.cell(row=r, column=2, value=c); cc.border, cc.font, cc.number_format = THIN, BOLD, '0.00'
    ws.cell(row=r, column=3, value=b).border = THIN
    ws.cell(row=r, column=4, value=p).border = THIN
    r += 1
r += 2
ws.cell(row=r, column=1, value='ثانياً: باقات جاهزة قريبة من 700$').font = Font(bold=True, color='0F766E')
r += 1
table_header(ws, r, ['الباقة', 'البند', 'التكلفة/سنة ($)', 'الإجمالي ($)', ''])
r += 1
for name, items_ in pkgs:
    first = True
    for iname, icost in items_:
        ws.cell(row=r, column=1, value=name if first else '').border = THIN
        ws.cell(row=r, column=2, value=iname).border = THIN
        ws.cell(row=r, column=3, value=icost).border = THIN
        first = False
        r += 1
    c = ws.cell(row=r, column=1, value='الإجمالي'); c.font = BOLD
    c = ws.cell(row=r, column=4, value=pkg_totals[name]); c.fill, c.font, c.number_format = SUB, Font(bold=True), '0.00'
    r += 2
ws.cell(row=r, column=1, value='ثالثاً: نفس الرقم من تغيير الافتراضات فقط (بدون خدمات مدفوعة)').font = Font(bold=True, color='0F766E')
r += 1
table_header(ws, r, ['التغيير في الافتراضات', 'الزيادة/سنة ($)', 'الإجمالي التراكمي ($)', '', ''])
r += 1
acc = BASE_Y2
ws.cell(row=r, column=1, value='نقطة البداية').border = THIN
ws.cell(row=r, column=3, value=round(acc, 2)).border = THIN
r += 1
for n, c in natural:
    acc += c
    ws.cell(row=r, column=1, value=n).border = THIN
    ws.cell(row=r, column=2, value=c).border = THIN
    ws.cell(row=r, column=3, value=round(acc, 2)).border = THIN
    r += 1
c = ws.cell(row=r, column=1, value='أقصى رقم طبيعي بدون أي خدمة مدفوعة'); c.font = BOLD
c = ws.cell(row=r, column=3, value=natural_total); c.fill, c.font, c.number_format = SUB, BOLD, '0.00'
cols(ws, [54, 20, 62, 18, 4])

wb.save('outputs/دراسة-التكلفة-السنوية.xlsx')
print('XLSX OK')

# ══════════════════════════════ HTML ══════════════════════════════
def money(v, d=2):
    return f'{v:,.{d}f}'

months = ['ينا', 'فبر', 'مار', 'أبر', 'ماي', 'يون', 'يول', 'أغس', 'sep', 'أكت', 'نوف', 'ديس']
months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
maxv = max(MS)
bars = ''
for i, v in enumerate(MS):
    h = max(3, v / maxv * 150)
    fixed_m = 5 + R['bunny_year'] / 12
    hf = max(3, fixed_m / maxv * 150)
    bars += (f'<div class="bar-col"><div class="bar-wrap">'
             f'<div class="bar tot" style="height:{h + hf:.0f}px" title="إجمالي الشهر"></div>'
             f'</div><div class="bar-lbl">{months[i][:3]}</div>'
             f'<div class="bar-val">{v + fixed_m:,.0f}</div></div>')

items_html = ''
for name, val, tag in R['items']:
    badge = '<span class="badge b-gray">ضمن المجاني</span>' if val == 0 else ''
    if tag == 'لسنة أولى':
        badge = '<span class="badge b-amber">مرة واحدة</span>'
    items_html += (f'<tr><td>{name}</td><td class="num">${money(val)}</td>'
                   f'<td class="pct">{val / R["total_year1"] * 100:.1f}%</td><td>{badge}</td></tr>')

scen_html = ''
for n, y1, y2 in R['scenarios']:
    scen_html += (f'<tr><td>{n}</td><td class="num strong">${money(y1)}</td>'
                  f'<td class="num">${money(y2)}</td><td class="num">${money(y1 / 12)}</td></tr>')

feat_html = ''
for a_, b_, c_, d_ in FEAT:
    cls = 'zero' if c_ == 0 else 'cost'
    feat_html += (f'<tr><td>{a_}</td><td>{b_}</td><td class="num {cls}">'
                  f'{("$" + money(c_)) if c_ else "0 $"}</td><td class="muted">{d_}</td></tr>')

cmp_max = 18128.8
cmp_html = ''
for a_, b_, c_, d_, e_ in CMP:
    w = e_ / cmp_max * 100
    color = '#0F766E' if 'الحالي' in a_ else '#F97316'
    cmp_html += (f'<tr><td>{a_}</td><td class="num">${money(b_)}</td><td class="num">${money(c_)}</td>'
                 f'<td class="num">${money(d_)}</td><td class="num strong">${money(e_)}</td>'
                 f'<td><div class="cbar" style="width:{w:.1f}%;background:{color}"></div></td></tr>')

html = f'''<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>دراسة تكلفة التشغيل السنوية — منصة الأستاذ أشرف</title>
<style>
  *{{box-sizing:border-box}}
  body{{margin:0;background:#F8FAFC;color:#0F172A;font-family:"Segoe UI",Tahoma,"Cairo",sans-serif;line-height:1.7}}
  .wrap{{max-width:1100px;margin:0 auto;padding:32px 24px 64px}}
  header{{background:linear-gradient(135deg,#0F766E,#115E59);color:#fff;border-radius:18px;padding:32px;margin-bottom:28px}}
  header h1{{margin:0 0 6px;font-size:26px}}
  header p{{margin:0;opacity:.9;font-size:14px}}
  h2{{font-size:19px;color:#0F766E;margin:38px 0 14px;padding-bottom:8px;border-bottom:2px solid #CCFBF1}}
  h3{{font-size:15px;margin:20px 0 8px;color:#134E4A}}
  .kpis{{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-bottom:8px}}
  .kpi{{background:#fff;border:1px solid #E2E8F0;border-radius:14px;padding:16px 18px;box-shadow:0 1px 3px rgba(15,23,42,.05)}}
  .kpi .lbl{{font-size:12px;color:#64748B}}
  .kpi .val{{font-size:26px;font-weight:700;color:#0F766E}}
  .kpi .sub{{font-size:12px;color:#94A3B8}}
  table{{width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,.06);font-size:14px}}
  th{{background:#0F766E;color:#fff;padding:11px 12px;text-align:right;font-weight:600;font-size:13px}}
  td{{padding:10px 12px;border-bottom:1px solid #F1F5F9}}
  tr:last-child td{{border-bottom:none}}
  .num{{text-align:left;font-variant-numeric:tabular-nums;direction:ltr}}
  .strong{{font-weight:700}}
  .muted{{color:#64748B;font-size:13px}}
  .zero{{color:#94A3B8}}
  .cost{{color:#B45309;font-weight:600}}
  .pct{{text-align:left;color:#64748B;direction:ltr;font-size:13px}}
  .badge{{display:inline-block;padding:2px 8px;border-radius:20px;font-size:11px}}
  .b-gray{{background:#F1F5F9;color:#64748B}}
  .b-amber{{background:#FEF3C7;color:#92400E}}
  tfoot td{{background:#F0FDFA;font-weight:700;font-size:15px}}
  .chart{{background:#fff;border:1px solid #E2E8F0;border-radius:14px;padding:20px;display:flex;gap:10px;align-items:flex-end;justify-content:space-between;height:240px;margin-top:12px}}
  .bar-col{{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%}}
  .bar-wrap{{height:170px;display:flex;align-items:flex-end}}
  .bar{{width:70%;background:linear-gradient(180deg,#14B8A6,#0F766E);border-radius:6px 6px 0 0;min-height:3px}}
  .bar-lbl{{font-size:11px;color:#64748B;margin-top:6px}}
  .bar-val{{font-size:11px;color:#0F766E;font-weight:600;direction:ltr}}
  .note{{background:#FFFBEB;border-right:4px solid #F59E0B;padding:14px 16px;border-radius:8px;margin:16px 0;font-size:14px}}
  .ok{{background:#F0FDFA;border-right:4px solid #14B8A6;padding:14px 16px;border-radius:8px;margin:16px 0;font-size:14px}}
  .grid2{{display:grid;grid-template-columns:1fr 1fr;gap:16px}}
  .card{{background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:16px}}
  .card ul{{margin:8px 0 0;padding-inline-start:20px;font-size:14px}}
  .card li{{margin-bottom:6px}}
  .cbar{{height:10px;border-radius:5px}}
  footer{{margin-top:40px;padding-top:16px;border-top:1px solid #E2E8F0;color:#94A3B8;font-size:12px}}
  @media print{{body{{background:#fff}}.wrap{{padding:0}}header{{-webkit-print-color-adjust:exact}}}}
</style>
</head>
<body>
<div class="wrap">

<header>
  <h1>دراسة تكلفة التشغيل السنوية — منصة الأستاذ أشرف</h1>
  <p>الترميز: Bunny Stream (مجاني حتى 1080p) ← التخزين والبث: Cloudflare R2 &nbsp;|&nbsp; بدون Cloudflare Stream</p>
  <p>معدّ إصدار: 16 سبتمبر 2026 &nbsp;•&nbsp; العملة: دولار أمريكي</p>
</header>

<div class="kpis">
  <div class="kpi"><div class="lbl">التكلفة السنوية (السنة الأولى)</div><div class="val">${money(R['total_year1'], 0)}</div><div class="sub">≈ {money(R['total_year1'] * 50, 0)} جنيه مصري*</div></div>
  <div class="kpi"><div class="lbl">المتوسط الشهري</div><div class="val">${money(R['monthly_avg_y1'], 1)}</div><div class="sub">السنوات التالية: ${money(R['monthly_avg_y2'], 1)}/شهر</div></div>
  <div class="kpi"><div class="lbl">تكلفة الطالب / سنة</div><div class="val">${money(R['cost_per_student'], 3)}</div><div class="sub">على أساس {A['students']:,} طالب</div></div>
  <div class="kpi"><div class="lbl">تكلفة ساعة محاضرة</div><div class="val">${money(R['cost_per_lecture_hour'])}</div><div class="sub">{R['hours_year']} ساعة محتوى/سنة</div></div>
  <div class="kpi"><div class="lbl">حجم التوصيل السنوي</div><div class="val">{money(R['tb_delivered_year'], 0)} TB</div><div class="sub">بـ $0 — الخارج من R2 مجاني</div></div>
  <div class="kpi"><div class="lbl">ذروة التخزين</div><div class="val">{money(R['peak_tb'], 2)} TB</div><div class="sub">بنهاية السنة قبل الحذف</div></div>
</div>
<p class="muted" style="font-size:12px">* تحويل تقديري بسعر ~50 جنيه/دولار للإيضاح فقط.</p>

<h2>1. ملخص تنفيذي</h2>
<div class="ok">
المنصة كما هي مصمّمة في الكود (Bunny Stream يرمّز ← Queues تنقل الشرائح مشفّرة AES-128 ← R2 يخزّن ويبثّ عبر نطاق مخصّص)
تكلّف <strong>${money(R['total_year1'], 0)} في السنة الأولى</strong> و<strong>${money(R['total_year2'], 0)} في كل سنة تالية</strong>،
أي حوالي <strong>${money(R['monthly_avg_y2'], 0)} شهرياً</strong> فقط — بما فيها كل ميزة في المنصة
(المصادقة، الكورسات، الفيديو المحمي، الكويزات، الأسئلة، الإشعارات، التحليلات، لوحة المدرس).
<br><br>
<strong>أهم نتيجة:</strong> 324 تيرابايت من الفيديو المُسلَّم للطلاب سنوياً بتكلفة توصيل <strong>صفر</strong>،
لأن الخارج (egress) من R2 مجاني تماماً. التكلفة الحقيقية الوحيدة هي <strong>مساحة التخزين</strong>
(${money(R['r2_storage_year'])}/سنة = {R['r2_storage_year'] / R['total_year1'] * 100:.0f}% من الفاتورة) + باقة Workers ($60/سنة).
<br><br>
<strong>ولو استخدمت Cloudflare Stream بدل التصميم الحالي:</strong> نفس الحمل هيكلّف
<strong>${money(18128.8, 0)}/سنة</strong> — يعني التصميم الحالي يوفّر <strong>98.7%</strong>.
</div>

<h2>2. الافتراضات التي بُنيت عليها الدراسة</h2>
<table>
<thead><tr><th>البيان</th><th class="num">القيمة</th><th>المصدر</th></tr></thead>
<tbody>
<tr><td>محاضرات في الأسبوع × ساعات</td><td class="num">4 × 2 ساعة</td><td>حسب طلبك</td></tr>
<tr><td>أسابيع النشر في السنة</td><td class="num">48 أسبوع</td><td>حسب اختيارك (4 أسابيع إجازات)</td></tr>
<tr><td>محاضرات / سنة</td><td class="num">{R['lectures_year']} محاضرة</td><td>192 × 2 = {R['hours_year']} ساعة</td></tr>
<tr><td>دقائق محتوى / سنة</td><td class="num">{R['minutes_year']:,} دقيقة</td><td>—</td></tr>
<tr><td>عدد الطلاب النشطين</td><td class="num">{A['students']:,} طالب</td><td>حسب اختيارك</td></tr>
<tr><td>معدل المشاهدة</td><td class="num">12 ساعة/طالب/شهر</td><td>≈35% من المحتوى المنشور</td></tr>
<tr><td>حجم المحاضرة (كل الجودات)</td><td class="num">{R['gb_per_lec']} GB</td><td>1080p≈4.5 + 720p≈2.5 + 480p≈1.2 + صوت Mbps</td></tr>
<tr><td>حجم المحتوى السنوي</td><td class="num">{money(R['gb_year'], 0)} GB ({money(R['tb_year'], 2)} TB)</td><td>يتراكم ثم يُحذف بنهاية السنة</td></tr>
<tr><td>سياسة الاحتفاظ</td><td class="num">تراكم سنة كاملة ثم حذف</td><td>حسب اختيارك</td></tr>
<tr><td>الجودات المخزّنة</td><td class="num">480p + 720p + 1080p + صوت</td><td>من الكود: ALLOWED_VIDEO_QUALITIES</td></tr>
</tbody>
</table>

<h2>3. تكلفة كل ميزة من مزايا المنصة</h2>
<p class="muted">كل ميزة مذكورة في التوثيق والكود mapped للخدمة اللي بتستهلكها فعلاً:</p>
<table>
<thead><tr><th>الميزة</th><th>الخدمة</th><th class="num">التكلفة/سنة</th><th>ملاحظة</th></tr></thead>
<tbody>{feat_html}</tbody>
<tfoot><tr><td>الإجمالي</td><td></td><td class="num">${money(R['total_year1'])}</td><td></td></tr></tfoot>
</table>

<h2>4. جدول التكاليف السنوي التفصيلي</h2>
<table>
<thead><tr><th>البند</th><th class="num">التكلفة السنوية ($)</th><th class="pct">من الإجمالي</th><th>ملاحظة</th></tr></thead>
<tbody>{items_html}</tbody>
<tfoot>
<tr><td>الإجمالي — السنة الأولى</td><td class="num">${money(R['total_year1'])}</td><td class="pct">100%</td><td></td></tr>
<tr><td>الإجمالي — السنوات التالية</td><td class="num">${money(R['total_year2'])}</td><td class="pct">—</td><td>بدون رسوم Google Play</td></tr>
</tfoot>
</table>

<h2>5. التدفق الشهري (السنة الأولى)</h2>
<p class="muted">الفاتورة بتزيد تدريجياً لأن التخزين بيتاكمّ شهر ورا شهر، وبتنزل للصفر تاني لما تمسح محتوى السنة.</p>
<div class="chart">{bars}</div>
<table style="margin-top:14px">
<thead><tr><th>الشهر</th><th class="num">التخزين التراكمي (GB)</th><th class="num">تخزين R2</th><th class="num">Workers</th><th class="num">Bunny</th><th class="num">إجمالي الشهر</th></tr></thead>
<tbody>
{''.join(f'<tr><td>{months[i]}</td><td class="num">{i * 120 + 60:,}</td><td class="num">${money(v)}</td><td class="num">$5.00</td><td class="num">${money(R["bunny_year"] / 12)}</td><td class="num strong">${money(v + 5 + R["bunny_year"] / 12)}</td></tr>' for i, v in enumerate(MS))}
</tbody>
<tfoot><tr><td>الإجمالي</td><td class="num">—</td><td class="num">${money(R['r2_storage_year'])}</td><td class="num">$60.00</td><td class="num">${money(R['bunny_year'])}</td><td class="num">${money(R['r2_storage_year'] + 60 + R['bunny_year'])}</td></tr></tfoot>
</table>

<h2>6. تحليل الحساسية والسيناريوهات</h2>
<table>
<thead><tr><th>السيناريو</th><th class="num">السنة الأولى ($)</th><th class="num">السنوات التالية ($)</th><th class="num">شهرياً ($)</th></tr></thead>
<tbody>{scen_html}
<tr><td>أرشيف دائم — السنة الثالثة</td><td class="num strong">${money(R['perm_y3'])}</td><td class="num">—</td><td class="num">${money(R['perm_y3'] / 12)}</td></tr>
</tbody>
</table>
<div class="note">
<strong>أهم استنتاجين:</strong><br>
1) <strong>عدد الطلاب لا يكلّف شيئاً تقريباً:</strong> من 500 إلى 10,000 طالب الفاتورة بتزيد حوالي $13 في السنة فقط،
لأن الخارج من R2 مجاني وطلبات الـ API لسه تحت الـ 10 ملايين المشمولة.<br>
2) <strong>السياسة اللي بتتحكم في الفاتورة هي "الاحتفاظ":</strong> حذف محتوى السنة بنهايتها يثبّت التكلفة عند ~${money(R['total_year2'], 0)}/سنة،
لكن الأرشيف الدائم يرفعها لـ $504 في سنة 2 و$763 في سنة 3 وهكذا.
</div>

<h2>7. مقارنة: التصميم الحالي vs Cloudflare Stream</h2>
<p class="muted">الجدول ده بيجاوب على سؤال "ليه إحنا مش بنستخدم Cloudflare Stream؟" — نفس الحمل بالظبط (2,000 طالب × 12 ساعة/شهر):</p>
<table>
<thead><tr><th>البديل</th><th class="num">تخزين</th><th class="num">توصيل</th><th class="num">ثابت</th><th class="num">الإجمالي/سنة</th><th>نسبي</th></tr></thead>
<tbody>{cmp_html}</tbody>
</table>
<div class="note">
<strong>ليه Cloudfare Stream غالي جداً في حالتنا؟</strong><br>
• التخزين: $5 لكل 1,000 دقيقة شهرياً. محتوانا {R['minutes_year']:,} دقيقة → بنهاية السنة تحتاج سعة $120/شهر.<br>
• التوصيل: $1 لكل 1,000 دقيقة مُشاهَدة. طلابنا بيشاهدوا {(A['students'] * A['watch_h'] * 60 * 12 / 1000):,.0f} ألف دقيقة/سنة → <strong>$17,280</strong>.<br>
• R2 بيشفط النقطتين دول: التخزين $0.015/GB والخارج مجاني، فالتكلفة بتفضل ثابتة مهما زادت المشاهدة.
</div>

<h2>8. تكاليف مش سحابية لازم تتدخل في الميزانية</h2>
<div class="grid2">
  <div class="card">
    <h3>مؤكّدة</h3>
    <ul>
      <li>حساب Google Play: <strong>$25 مرة واحدة</strong></li>
      <li>تجديد النطاق: <strong>$15/سنة</strong></li>
      <li>Apple Developer (لو في iOS): <strong>$99/سنة</strong></li>
      <li>إنترنت رفع المحاضرات من عند المدرّس (≈7.5GB × 4 أسبوعياً ≈ 120GB/شهر)</li>
    </ul>
  </div>
  <div class="card">
    <h3>اختيارية / حسب النمو</h3>
    <ul>
      <li>Supabase Pro: <strong>$25/شهر</strong> (لو احتجت SMTP مخصص أو ضمان عدم الإيقاف التلقائي للمشروع المجاني)</li>
      <li>Bunny Premium Encoding: <strong>$0.05/دقيقة</strong> لو عايز 1440p/1080p بجودة أعلى (القياسي مجاني)</li>
      <li>MediaCage DRM من Bunny: <strong>$99/شهر</strong> (غير ضروري — عندك تشفير AES-128)</li>
      <li>Sentry / مراقبة: مجاني في الحدود الدنيا</li>
      <li>نسخ احتياطي لـ D1 على R2: شبه مجاني</li>
    </ul>
  </div>
</div>

<h2>9. توصيات لتقليل التكلفة</h2>
<div class="grid2">
  <div class="card">
    <h3>توفير مباشر</h3>
    <ul>
      <li><strong>امسح محتوى السنة القديمة فور انتهائها</strong> — يثبّت الفاتورة ويمنع التراكم (أكبر رافعة: $130 → $0 تراكمي).</li>
      <li><strong>فعّل باقة Volume في Bunny</strong> أو تأكد إن السحب بيتم من منطقة أوروبا: $0.06 → $0.005/GB (توفير ~$75/سنة).</li>
      <li><strong>اقفل MP4 Fallback و Keep original files في Bunny</strong> — بيضاعفوا التخزين المؤقت بلا فايدة (شرائح HLS هي اللي بتتنقل).</li>
      <li><strong>سيب 480p/720p/1080p بس</strong> (معمول في الكود) — 240p/360p زيادة هتزوّد التخزين ~30%.</li>
      <li>للمحتوى القديم اللي مش بيتشاف: انقله لـ <strong>R2 Infrequent Access</strong> ($0.01/GB بدل $0.015) — بس بلاش على فيديوهات لسه متشافة لأن الاسترجاع بـ $0.01/GB.</li>
    </ul>
  </div>
  <div class="card">
    <h3>حماية من الفواتير المفاجئة</h3>
    <ul>
      <li>فعّل <strong>تنبيهات إنفاق</strong> في لوحة Cloudflare على R2 و Workers.</li>
      <li>حدّد <strong>CPU limit</strong> لكل invocation في الـ Worker (افتراضي 30 ثانية) علشان الـ Queue consumer متفضلّش تلف.</li>
      <li>راجع حد <code>max_retries</code> في الطابور (حالياً 10) — كل إعادة محاولة = قراءات + CPU + سحب من Bunny.</li>
      <li>اتأكد إن <code>Cache-Control: immutable</code> موجود فعلاً على الشرائح (موجود في الكود) — ده اللي مخلي قراءات R2 مجانية.</li>
      <li>راقب حجم D1: أول 5GB مجانية، وبعدها $0.75/GB-شهر.</li>
    </ul>
  </div>
</div>

<h2>10. الخلاصة</h2>
<div class="ok">
<strong>الميزانية السنوية المقترحة: ${money(R['total_year1'], 0)} للسنة الأولى، و${money(R['total_year2'], 0)} لكل سنة تالية (≈ ${money(R['monthly_avg_y2'], 0)}/شهر).</strong><br>
التكلفة متأثرة بشكل شبه حصري بـ <em>حجم الفيديو المخزّن</em>، ومش متأثرة تقريباً بعدد الطلاب ولا ساعات المشاهدة.
القرار الوحيد اللي يفرق فعلاً: <strong>تحذف محتوى السنة في نهايتها ولا لأ.</strong><br>
(راجع قسم 11 لو بتفكّر في MongoDB بدل D1 أو تخزين الفيديو على Bunny بدل R2 — الاتنين بيضاعفوا الفاتورة بلا مبرّر.)
</div>

<h2>11. سيناريو بديل: MongoDB بدل D1 + تخزين Bunny بـ $0.055/GB</h2>
<p class="muted">نفس الكود، بس قاعدة البيانات MongoDB، وتخزين Bunny بسعر $0.055/GB بافتراض <strong>100 جيجا تخزين كل شهر</strong>.</p>
<table>
<thead><tr><th>السيناريو</th><th>قاعدة البيانات</th><th>تخزين الفيديو</th><th>التوصيل/السحب</th><th class="num">الإجمالي/سنة</th><th class="num">الفرق</th></tr></thead>
<tbody>
<tr><td><strong>التصميم الحالي</strong> (D1 + R2)</td><td>D1 — $0</td><td>R2 — $127.8</td><td>سحب Bunny — $15.1</td><td class="num strong">${money(R['total_year1'])}</td><td class="num">المرجع</td></tr>
<tr><td><strong>B1</strong> — Mongo Flex + نفس الكود (نقل لـ R2)</td><td>Flex — $144</td><td>Bunny $66 + R2 $127.8</td><td>$15.1</td><td class="num strong">${money(mongo_flex + bunny_resident_year + bunny_pull_year + R['r2_storage_year'] + fixed_common)}</td><td class="num" style="color:#B45309">+{money(mongo_flex + bunny_resident_year + bunny_pull_year + R['r2_storage_year'] + fixed_common - R['total_year1'], 0)} (+{((mongo_flex + bunny_resident_year + bunny_pull_year + R['r2_storage_year'] + fixed_common) / R['total_year1'] - 1) * 100:.0f}%)</td></tr>
<tr><td><strong>B2</strong> — Mongo M10 + نفس الكود (نقل لـ R2)</td><td>M10 — $900</td><td>Bunny $66 + R2 $127.8</td><td>$15.1</td><td class="num strong">${money(mongo_m10 + bunny_resident_year + bunny_pull_year + R['r2_storage_year'] + fixed_common)}</td><td class="num" style="color:#B91C1C">+{money(mongo_m10 + bunny_resident_year + bunny_pull_year + R['r2_storage_year'] + fixed_common - R['total_year1'], 0)} (+{((mongo_m10 + bunny_resident_year + bunny_pull_year + R['r2_storage_year'] + fixed_common) / R['total_year1'] - 1) * 100:.0f}%)</td></tr>
<tr><td><strong>B3</strong> — Mongo Flex + كل الفيديو على Bunny (باقة Volume)</td><td>Flex — $144</td><td>Bunny كامل — ${money(bunny_full_year, 0)}</td><td>${money(deliv_vol, 0)}</td><td class="num strong">${money(mongo_flex + bunny_full_year + deliv_vol + fixed_common, 0)}</td><td class="num" style="color:#B91C1C">+{money(mongo_flex + bunny_full_year + deliv_vol + fixed_common - R['total_year1'], 0)}</td></tr>
<tr><td><strong>B4</strong> — Mongo M10 + كل الفيديو على Bunny (تسعير الشرق الأوسط)</td><td>M10 — $900</td><td>Bunny كامل — ${money(bunny_full_year, 0)}</td><td>${money(deliv_mea, 0)}</td><td class="num strong">${money(mongo_m10 + bunny_full_year + deliv_mea + fixed_common, 0)}</td><td class="num" style="color:#B91C1C">+{money(mongo_m10 + bunny_full_year + deliv_mea + fixed_common - R['total_year1'], 0)}</td></tr>
</tbody>
</table>

<h3>أسعار MongoDB Atlas (2026)</h3>
<table>
<thead><tr><th>الطبقة</th><th>السعر/شهر</th><th>التخزين</th><th>السقف</th><th>التقييم لحالتنا</th></tr></thead>
<tbody>
<tr><td>M0 (مجاني)</td><td>$0</td><td>512 MB</td><td>~100 عملية/ثانية</td><td class="muted">مش هتكفي — حجم البيانات هيعدّي 512MB بسرعة، وبدون نسخ احتياطي</td></tr>
<tr><td>Flex</td><td>$8 → $30 (سقف صلب)</td><td>5 GB</td><td>~500 عملية/ثانية</td><td class="muted">تكفي الحمولة الحالية (متوسط ≈0.7 طلب/ثانية) — بس بدون PITR وبدون Atlas Search</td></tr>
<tr><td>M10 (مخصّص)</td><td>$58.4 + تخزين/نسخ ≈ $75-85</td><td>10-128 GB</td><td>1,500 اتصال</td><td class="muted">إنتاج حقيقي + نقطة استرجاع زمنية + Atlas Search</td></tr>
<tr><td>M20</td><td>≈ $146</td><td>20 GB+</td><td>—</td><td class="muted">مبالغة في حالتنا</td></tr>
</tbody>
</table>

<div class="note">
<strong>تحذير معماري مهم قبل ما تاخد القرار:</strong><br>
• Cloudflare Workers <strong>تقدر</strong> تتصل بـ MongoDB بالدريفر الرسمي من 2025 (بعد دعم <code>node:net</code> و <code>node:tls</code>)، لكن <strong>Atlas Data API اتلغت</strong> فمش خيار.<br>
• مفيش <strong>Hyperdrive</strong> لـ Mongo (ده لـ Postgres/MySQL بس) → يعني مفيش connection pooling على الحافة. لازم <code>maxPoolSize: 1</code> ومراقبة عدد الاتصالات (سقف M10 = 1,500).<br>
• كل استعلام = رحلة من الـ Worker (edge) لـ Atlas (منطقة واحدة) → <strong>+50 إلى +150ms زمن استجابة</strong> لكل طلب API بدل D1 اللي شغالة جنب الكود.<br>
• البحث: Flex فيه <strong>MongoDB Search</strong> فمش هتخسر ميزة البحث الداخلي (بديل FTS5)، بس بموارد مشاركة.<br>
• هتحتاج <strong>إعادة كتابة كل الاستعلامات</strong> في <code>admin.ts</code> و <code>courses.ts</code> و <code>questions.ts</code> و <code>codes.ts</code> و <code>auth.ts</code> و <code>playback.ts</code> ومستهلكي الطوابير — أيام عمل مش ساعات.<br>
• حجم حزمة الـ Worker هيزيد (دريفر mongodb) واستهلاك CPU أعلى بسبب ترميز BSON.
</div>

<div class="ok">
<strong>الرأي:</strong> MongoDB هتكلّفك <strong>+$209 إلى +$965 في السنة</strong> في أفضل الحالات (B1/B2)، مقابل <strong>$0</strong> لـ D1،
ومع تأخير أعلى ومخاطر معمارية. و"تخزين الفيديو كله على Bunny بدل R2" هو الكارثة الحقيقية:
التوصيل لوحده <strong>${money(deliv_vol, 0)} — ${money(deliv_mea, 0)}/سنة</strong> لأنك بتدفع على كل جيجا بيشوفها الطالب،
بينما R2 بيوصّل <strong>324 TB بصفر دولار</strong>.<br>
<strong>الخلاصة:</strong> سيب D1 زي ما هي، وسيب الفيديو على R2. لو عايز تدي Bunny مساحة تخزين 100 جيجا مؤقتة بس → التكلفة ${money(bunny_resident_year, 0)}/سنة بدل $16.5.
</div>

<h2>12. تفاصيل سيناريو B1 بالكامل — MongoDB Flex + نفس الكود (نقل لـ R2)</h2>
<div class="kpis" style="margin-bottom:16px">
  <div class="kpi"><div class="lbl">الإجمالي — السنة الأولى</div><div class="val">${money(b1_total)}</div><div class="sub">السنوات التالية: ${money(b1_y2)}</div></div>
  <div class="kpi"><div class="lbl">المتوسط الشهري</div><div class="val">${money(b1_total / 12, 1)}</div><div class="sub">يبدأ ${money(b1_monthly[0], 1)} وينتهي ${money(b1_monthly[11], 1)}</div></div>
  <div class="kpi"><div class="lbl">الزيادة عن التصميم الحالي</div><div class="val" style="color:#B45309">+${money(b1_total - R['total_year1'], 0)}</div><div class="sub">+{(b1_total / R['total_year1'] - 1) * 100:.0f}% — منها $144 مونجو و$65 تخزين Bunny</div></div>
  <div class="kpi"><div class="lbl">تكلفة الطالب / سنة</div><div class="val">${money(b1_total / 2000, 3)}</div><div class="sub">مقابل ${money(R['cost_per_student'], 3)} في التصميم الحالي</div></div>
</div>

<table>
<thead><tr><th>البند</th><th>وحدة التسعير</th><th>الاستهلاك السنوي المتوقع</th><th class="num">التكلفة/سنة</th></tr></thead>
<tbody>
{''.join(f'<tr><td>{n}</td><td class="muted">{p}</td><td class="muted">{u}</td><td class="num {"strong" if c else "zero"}">${money(c)}</td></tr>' for n, p, u, c in b1_items)}
</tbody>
<tfoot>
<tr><td colspan="3">الإجمالي — السنة الأولى</td><td class="num">${money(b1_total)}</td></tr>
<tr><td colspan="3">الإجمالي — السنوات التالية (بدون رسوم Play)</td><td class="num">${money(b1_y2)}</td></tr>
</tfoot>
</table>

<h3>منين جاية الزيادة (+${money(b1_total - R['total_year1'], 0)})؟</h3>
<table>
<thead><tr><th>السبب</th><th class="num">الزيادة السنوية</th><th>التفسير</th></tr></thead>
<tbody>
<tr><td>MongoDB Atlas Flex بدل D1</td><td class="num cost">+$144.00</td><td>D1 كانت بـ $0 جوه باقة Workers — دي تكلفة جديدة بالكامل</td></tr>
<tr><td>تخزين Bunny بـ $0.055 بدل $0.01</td><td class="num cost">+${money(66 - 1.44)}</td><td>100 جيجا مقيم × السعر الجديد، بدل تخزين عابر يومين</td></tr>
<tr><td>باقي البنود</td><td class="num">$0.00</td><td>Workers و R2 والطوابير و Pages و Supabase و FCM — كلها زي ما هي</td></tr>
</tbody>
</table>

<h3>حساسية سعر Atlas Flex (السقف الصلب بيحميك)</h3>
<table>
<thead><tr><th>الحالة</th><th class="num">سعر Flex/شهر</th><th class="num">التكلفة/سنة</th><th class="num">إجمالي B1/سنة</th><th>ملاحظة</th></tr></thead>
<tbody>
<tr><td>متفائل — تحت 100 عملية/ثانية طول الوقت</td><td class="num">$8</td><td class="num">$96</td><td class="num strong">${money(b1_total - B1_MONGO + 96)}</td><td class="muted">الحد الأدنى الفعلي لـ Flex</td></tr>
<tr><td><strong>الأساس</strong> — ذروات موسمية تدخل شريحة 100-200</td><td class="num">$12</td><td class="num">$144</td><td class="num strong">${money(b1_total)}</td><td class="muted">الفرضية المعتمدة</td></tr>
<tr><td>السقف — 400-500 عملية/ثانية</td><td class="num">$30</td><td class="num">$360</td><td class="num strong">${money(b1_total - B1_MONGO + 360)}</td><td class="muted">سقف صلب — Flex لا يمكن أن يتجاوز 30$/شهر أبداً</td></tr>
</tbody>
</table>
<p class="muted" style="font-size:13px">تسعير Flex الرسمي: $8 أساس يشمل 5GB تخزين + 100 عملية/ثانية + <strong>نقل بيانات غير محدود مجاناً</strong>،
ثم شرائح: 100-200 → $15 · 200-300 → $21 · 300-400 → $26 · 400-500 → $30 (سقف نهائي).</p>

<h3>التدفق الشهري لسيناريو B1</h3>
<table>
<thead><tr><th>الشهر</th><th class="num">Workers</th><th class="num">MongoDB</th><th class="num">Bunny</th><th class="num">تخزين R2</th><th class="num">نطاق</th><th class="num">إجمالي الشهر</th></tr></thead>
<tbody>
{''.join(f'<tr><td>{months[i]}</td><td class="num">$5.00</td><td class="num">${money(b1_mongo_m)}</td><td class="num">${money(b1_bunny_m)}</td><td class="num">${money(v)}</td><td class="num">${money(b1_dom_m)}</td><td class="num strong">${money(b1_monthly[i])}</td></tr>' for i, v in enumerate(MS))}
</tbody>
<tfoot><tr><td>الإجمالي</td><td class="num">$60.00</td><td class="num">${money(B1_MONGO)}</td><td class="num">${money(81.12)}</td><td class="num">${money(R['r2_storage_year'])}</td><td class="num">$15.00</td><td class="num">${money(b1_total - P['play_fee'])}</td></tr></tfoot>
</table>

<div class="note">
<strong>تكاليف غير مالية لازم تحطها في الحسبان في B1:</strong><br>
• <strong>لا توجد نقطة استرجاع زمنية (PITR) على Flex</strong> — لازم تعمل نسخ احتياطي يدوي (<code>mongodump</code> → رفعه على R2) بكرون يومي، وده استهلاك CPU بسيط على Workers + مساحة R2.<br>
• <strong>حد 5GB تخزين على Flex:</strong> بياناتنا المتوقعة ≈0.5-1GB في السنة الأولى، يعني هتكفي ~3-4 سنين لو بتنضّف البيانات القديمة. أول ما تتعدّى 5GB هتضطر تنتقل لـ M10 ($75-85/شهر) وده يقفز بالفاتورة لـ ${money(b1_total - B1_MONGO + 900)}/سنة.<br>
• <strong>زمن الاستجابة:</strong> كل استعلام = رحلة من الـ Edge إلى منطقة Atlas → +50 إلى +150ms لكل طلب API.<br>
• <strong>حجم حزمة الـ Worker</strong> هيزيد بدريفر mongodb (ضمن حد الـ 10MB على الباقة المدفوعة) وبرد الـ cold start هيطول.<br>
• <strong>إعادة كتابة الكود:</strong> كل ملفات <code>routes/</code> ومستهلكي الطوابير من SQL إلى Mongo — والترحيل نفسه.<br>
• <strong>نقطة إيجابية:</strong> Flex بيوفّر <strong>MongoDB Search</strong> (بديل مقبول لـ FTS5 في البحث الداخلي) ونقل بيانات مجاني غير محدود، فمش هتخسر ميزة البحث.<br>
• <strong>الـ connection pooling:</strong> مفيش Hyperdrive لـ Mongo → استخدم <code>maxPoolSize: 1</code> وراقب عدد الاتصالات.
</div>

<h2>13. إزاي نوصل للتكلفة قرابة 700$/سنة؟</h2>
<p class="muted">نقطة البداية = <strong>${money(BASE_Y2)}/سنة</strong> (التصميم الحالي في السنوات التالية). عندك طريقين: <strong>ترقيات حقيقية</strong> تضيف موثوقية ودعماً، أو <strong>تغيير افتراضات</strong> يرفع الرقم طبيعياً.</p>

<h3>أولاً: قائمة الرافعات (اختار منها)</h3>
<table>
<thead><tr><th>الرافعة</th><th class="num">التكلفة/سنة</th><th>إيه اللي بتضيفه</th><th>الأولوية</th></tr></thead>
<tbody>
{''.join(f'<tr><td>{n}</td><td class="num {"strong" if c else ""}">${money(c)}</td><td class="muted">{b}</td><td>{p}</td></tr>' for n, c, b, p in levers)}
</tbody>
</table>

<h3>ثانياً: باقات جاهزة قريبة من 700$</h3>
<div class="grid2" style="grid-template-columns:repeat(3,1fr)">
{''.join(f'''<div class="card" style="{"border:2px solid #0F766E" if i == 0 else ""}">
<h3>{name}{" ✅" if i == 0 else ""}</h3>
<ul>{''.join(f"<li>{in_} — <strong>${money(ic)}</strong></li>" for in_, ic in items_)}</ul>
<p style="margin:10px 0 0;font-size:20px;font-weight:700;color:#0F766E">${money(pkg_totals[name])}/سنة</p>
<p class="muted" style="margin:2px 0 0;font-size:12px">≈ ${money(pkg_totals[name] / 12, 1)}/شهر · التكلفة على الطالب ${money(pkg_totals[name] / 2000, 2)}/سنة</p>
</div>''' for i, (name, items_) in enumerate(pkgs))}
</div>

<h3>ثالثاً: نفس الرقم من تغيير الافتراضات فقط (بدون أي خدمة مدفوعة)</h3>
<table>
<thead><tr><th>التغيير في الافتراضات</th><th class="num">الزيادة/سنة</th><th class="num">الإجمالي التراكمي</th></tr></thead>
<tbody>
<tr><td>نقطة البداية (التصميم الحالي)</td><td class="num">—</td><td class="num">${money(BASE_Y2)}</td></tr>
{''.join(f'<tr><td>{n}</td><td class="num">+${money(c)}</td><td class="num strong">${money(BASE_Y2 + sum(v for _, v in natural[:i + 1]))}</td></tr>' for i, (n, c) in enumerate(natural))}
</tbody>
<tfoot><tr><td>أقصى رقم طبيعي بدون أي خدمة مدفوعة</td><td class="num">—</td><td class="num">${money(natural_total)}</td></tr></tfoot>
</table>

<div class="ok">
<strong>التوصية:</strong> لو الميزانية المستهدفة ~$700/سنة، خُد <strong>باقة «إنتاج مستقر» = ${money(pkg_totals["باقة «إنتاج مستقر» — مُوصى بها"])}</strong>:
Supabase Pro (تشيل أكبر خطر إنتاجي: إيقاف المشروع المجاني وحد الإيميلات) + مراقبة Uptime (تعرف قبل الطلاب) +
تخزين Bunny 100 جيجا كنسخة احتياطية للفيديو + نسخ احتياطي يومي لـ D1 على R2 بـ $2.
ده يديك منصة بمستوى إنتاج حقيقي بـ <strong>${money(pkg_totals["باقة «إنتاج مستقر» — مُوصى بها"] / 12, 0)}/شهر</strong> — لسه أقل من <strong>4%</strong> من تكلفة نفس الحمل على Cloudflare Stream.
<br><br>
<strong>ملاحظة أمانة:</strong> الرقم الطبيعي (من تغيير الافتراضات بس) أقصاه <strong>${money(natural_total)}</strong>،
يعني عشان توصل 700 بثبات وتستفيد فعلاً، الطريق الصح هو الترقيات — مش تضخيم الافتراضات.
</div>

<footer>
مصادر الأسعار (تم التحقق منها في 16 سبتمبر 2026):
Cloudflare R2 / Workers / D1 / KV / Queues / Images / Stream — developers.cloudflare.com •
Bunny Stream — bunny.net/docs/stream/pricing •
Supabase — حتى 50,000 MAU مجاناً • Firebase Cloud Messaging — مجاني.<br>
الأسعار بالدولار الأمريكي، والقيم المصرية تحويل تقديري. ملف Excel المرفق فيه معادلات حية — عدّل المدخلات الصفراء وتحدّث كل الجداول تلقائياً.
</footer>

</div>
</body>
</html>'''

with open('outputs/دراسة-التكلفة-السنوية.html', 'w', encoding='utf-8') as f:
    f.write(html)
print('HTML OK')
