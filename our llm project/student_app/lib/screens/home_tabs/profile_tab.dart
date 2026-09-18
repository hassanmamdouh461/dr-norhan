import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:image_picker/image_picker.dart';

import '../../blocs/auth/auth_bloc.dart';
import '../../blocs/auth/auth_event.dart';
import '../../config/theme.dart';
import '../../services/push_notification_service.dart';
import '../../widgets/app_loading_indicator.dart';
import 'home_widgets.dart';

/// Profile tab: avatar, personal info + edit, devices management,
/// exam results, financial history and device reset requests.
class ProfileTab extends StatefulWidget {
  final Map<String, dynamic>? profile; // null => guest

  const ProfileTab({super.key, required this.profile});

  @override
  State<ProfileTab> createState() => _ProfileTabState();
}

class _ProfileTabState extends State<ProfileTab> {
  Future<Map<String, dynamic>>? _devicesFuture;
  Future<Map<String, dynamic>>? _quizAttemptsFuture;
  Future<Map<String, dynamic>>? _financialsFuture;
  Future<Map<String, dynamic>>? _resetRequestsFuture;

  bool get _isGuest => widget.profile == null;

  @override
  void initState() {
    super.initState();
    if (!_isGuest) _loadSections();
  }

  void _loadSections() {
    final apiService = context.read<AuthBloc>().apiService;
    setState(() {
      _devicesFuture = apiService.getMyDevices();
      _quizAttemptsFuture = apiService.getMyQuizAttempts();
      _financialsFuture = apiService.getMyFinancials();
      _resetRequestsFuture = apiService.getMyDeviceResetRequests();
    });
  }

  Future<void> _refresh() async {
    _loadSections();
    context.read<AuthBloc>().add(AuthCheckRequested());
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    if (_isGuest) {
      return const Column(
        children: [
          TabHeader(title: 'حسابي الشخصي', isGuest: true),
          Expanded(
            child: LoginPromptView(
              title: 'أنت تتصفح كزائر',
              description: 'سجّل دخولك أو أنشئ حساباً جديداً لعرض ملفك الشخصي وكورساتك ونتائج امتحاناتك.',
              icon: Icons.person_outline,
            ),
          ),
        ],
      );
    }

    final profile = widget.profile!;

    return Column(
      children: [
        const TabHeader(title: 'حسابي الشخصي', isGuest: false),
        Expanded(
          child: RefreshIndicator(
            onRefresh: _refresh,
            color: AppTheme.primary,
            child: SingleChildScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(20.0),
              child: Column(
                children: [
                  _buildAvatarHeader(theme, profile),
                  const SizedBox(height: 24),
                  _buildInfoCard(theme, profile),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: () => _showEditProfileSheet(profile),
                      icon: const Icon(Icons.edit_outlined, size: 18),
                      label: const Text(
                        'تعديل البيانات الشخصية',
                        style: TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.bold, fontSize: 13),
                      ),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppTheme.primary,
                        side: BorderSide(color: AppTheme.primary.withOpacity(0.4)),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),
                  _buildNotificationsCard(theme),
                  const SizedBox(height: 20),
                  _buildDevicesSection(theme),
                  const SizedBox(height: 14),
                  _buildExpansionSection(
                    title: 'نتائج امتحاناتي',
                    icon: Icons.emoji_events_outlined,
                    future: _quizAttemptsFuture,
                    builder: (data) => _buildQuizAttemptsList(theme, data),
                  ),
                  const SizedBox(height: 14),
                  _buildExpansionSection(
                    title: 'سجل عمليات الدفع والتفعيل',
                    icon: Icons.account_balance_wallet_outlined,
                    future: _financialsFuture,
                    builder: (data) => _buildFinancialsList(theme, data),
                  ),
                  const SizedBox(height: 14),
                  _buildExpansionSection(
                    title: 'طلبات فك ارتباط الأجهزة',
                    icon: Icons.phonelink_erase_outlined,
                    future: _resetRequestsFuture,
                    builder: (data) => _buildResetRequestsList(theme, data),
                  ),
                  const SizedBox(height: 24),
                  TextButton.icon(
                    onPressed: _confirmLogout,
                    icon: const Icon(Icons.logout, color: Colors.redAccent),
                    label: const Text(
                      'تسجيل الخروج',
                      style: TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold, fontFamily: 'Cairo'),
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  // ── Avatar + name header ──
  Widget _buildAvatarHeader(ThemeData theme, Map<String, dynamic> profile) {
    final avatarUrl = profile['avatar_url'] as String? ?? '';
    return Column(
      children: [
        GestureDetector(
          onTap: _pickAndUploadAvatar,
          child: Stack(
            children: [
              CircleAvatar(
                radius: 45,
                backgroundColor: AppTheme.primary.withOpacity(0.1),
                backgroundImage: avatarUrl.isNotEmpty ? CachedNetworkImageProvider(avatarUrl) : null,
                child: avatarUrl.isNotEmpty ? null : const Icon(Icons.person, size: 48, color: AppTheme.primary),
              ),
              Positioned(
                bottom: 0,
                right: 0,
                child: Container(
                  padding: const EdgeInsets.all(4),
                  decoration: const BoxDecoration(color: AppTheme.primary, shape: BoxShape.circle),
                  child: const Icon(Icons.camera_alt_outlined, size: 16, color: Colors.white),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Text(
          profile['full_name'] ?? '',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: theme.colorScheme.onSurface,
            fontFamily: 'Cairo',
          ),
        ),
        Text(
          profile['email'] ?? '',
          style: TextStyle(
            fontSize: 13,
            color: theme.colorScheme.onSurface.withOpacity(0.6),
            fontFamily: 'Cairo',
          ),
        ),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          decoration: BoxDecoration(
            color: AppTheme.primary.withOpacity(0.1),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: AppTheme.primary.withOpacity(0.2)),
          ),
          child: Text(
            "كود الطالب: ${profile['student_code'] ?? 'غير متوفر'}",
            style: const TextStyle(
              fontSize: 13,
              color: AppTheme.primary,
              fontWeight: FontWeight.bold,
              fontFamily: 'Cairo',
            ),
          ),
        ),
      ],
    );
  }

  // ── Personal info rows ──
  Widget _buildInfoCard(ThemeData theme, Map<String, dynamic> profile) {
    return Container(
      decoration: BoxDecoration(
        color: theme.cardTheme.color ?? theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: theme.colorScheme.onSurface.withOpacity(0.08)),
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          _buildInfoRow(theme, Icons.phone_android_outlined, 'رقم الموبايل', profile['phone'] ?? 'غير مسجل'),
          Divider(color: theme.colorScheme.onSurface.withOpacity(0.08)),
          _buildInfoRow(theme, Icons.family_restroom_outlined, 'هاتف ولي الأمر', profile['parent_phone'] ?? 'غير مسجل'),
          Divider(color: theme.colorScheme.onSurface.withOpacity(0.08)),
          _buildInfoRow(theme, Icons.calendar_today_outlined, 'الصف الدراسي', profile['grade'] ?? ''),
          if ((profile['branch'] ?? '').toString().isNotEmpty) ...[
            Divider(color: theme.colorScheme.onSurface.withOpacity(0.08)),
            _buildInfoRow(theme, Icons.school_outlined, 'الشعبة / التخصص', profile['branch'] ?? ''),
          ],
          Divider(color: theme.colorScheme.onSurface.withOpacity(0.08)),
          _buildInfoRow(theme, Icons.map_outlined, 'المحافظة', profile['governorate'] ?? ''),
        ],
      ),
    );
  }

  Widget _buildInfoRow(ThemeData theme, IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8.0),
      child: Row(
        children: [
          Icon(icon, color: AppTheme.primary.withOpacity(0.8), size: 20),
          const SizedBox(width: 12),
          Text(
            label,
            style: TextStyle(
              color: theme.colorScheme.onSurface.withOpacity(0.54),
              fontSize: 13,
              fontFamily: 'Cairo',
            ),
          ),
          const Spacer(),
          Flexible(
            child: Text(
              value,
              style: TextStyle(
                color: theme.colorScheme.onSurface,
                fontSize: 13,
                fontWeight: FontWeight.bold,
                fontFamily: 'Cairo',
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }

  // ── Enable push notifications (explicit request) ──
  Widget _buildNotificationsCard(ThemeData theme) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: theme.cardTheme.color ?? theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: theme.colorScheme.onSurface.withOpacity(0.08)),
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        leading: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(color: AppTheme.primary.withOpacity(0.1), shape: BoxShape.circle),
          child: const Icon(Icons.notifications_active_outlined, color: AppTheme.primary, size: 20),
        ),
        title: Text(
          'تفعيل إشعارات التطبيق',
          style: TextStyle(
            color: theme.colorScheme.onSurface,
            fontSize: 14,
            fontWeight: FontWeight.bold,
            fontFamily: 'Cairo',
          ),
        ),
        subtitle: Text(
          'اسمح لنا بإرسال إشعارات الكورسات والامتحانات الجديدة',
          style: TextStyle(
            color: theme.colorScheme.onSurface.withOpacity(0.4),
            fontSize: 11,
            fontFamily: 'Cairo',
          ),
        ),
        trailing: const Icon(Icons.chevron_left, size: 20),
        onTap: _enablePushNotifications,
      ),
    );
  }

  Future<void> _enablePushNotifications() async {
    final apiService = context.read<AuthBloc>().apiService;
    final token = await PushNotificationService.instance.registerToken(apiService);
    if (!mounted) return;
    if (token != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('تم تفعيل الإشعارات بنجاح', style: TextStyle(fontFamily: 'Cairo')),
          backgroundColor: Colors.green,
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('يرجى السماح بالإشعارات من إعدادات الهاتف', style: TextStyle(fontFamily: 'Cairo')),
          backgroundColor: Colors.redAccent,
        ),
      );
    }
  }

  // ── Devices management (list + unbind) ──
  Widget _buildDevicesSection(ThemeData theme) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: theme.cardTheme.color ?? theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: theme.colorScheme.onSurface.withOpacity(0.08)),
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'أجهزتي المربوطة بالحساب',
            style: TextStyle(
              fontWeight: FontWeight.bold,
              color: theme.colorScheme.onSurface,
              fontSize: 14,
              fontFamily: 'Cairo',
            ),
          ),
          const SizedBox(height: 12),
          FutureBuilder<Map<String, dynamic>>(
            future: _devicesFuture,
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting) {
                return const Padding(
                  padding: EdgeInsets.all(12.0),
                  child: Center(child: AppLoadingIndicator(size: 22)),
                );
              }
              final devices = snapshot.data?['devices'] as List? ?? [];
              if (snapshot.hasError || devices.isEmpty) {
                return Text(
                  'لا توجد أجهزة مسجلة',
                  style: TextStyle(
                    color: theme.colorScheme.onSurface.withOpacity(0.4),
                    fontSize: 12,
                    fontFamily: 'Cairo',
                  ),
                );
              }
              final currentDeviceId = context.read<AuthBloc>().apiService.deviceService.deviceId;
              return Column(
                children: devices.map<Widget>((d) {
                  final bool isCurrent = d['device_id'] == currentDeviceId;
                  final bool isTrusted = d['is_trusted'] == 1 || d['is_trusted'] == true;
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Row(
                      children: [
                        Icon(
                          d['platform'] == 'web' ? Icons.laptop_outlined : Icons.phone_android_outlined,
                          color: isTrusted
                              ? (theme.brightness == Brightness.dark ? Colors.greenAccent : Colors.green.shade700)
                              : Colors.orangeAccent,
                          size: 20,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                '${d['model'] ?? 'جهاز'}${isCurrent ? ' (هذا الجهاز)' : ''}',
                                style: TextStyle(
                                  color: theme.colorScheme.onSurface,
                                  fontSize: 13,
                                  fontWeight: FontWeight.bold,
                                  fontFamily: 'Cairo',
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              Text(
                                isTrusted ? 'جهاز موثوق - مسجل أمنياً' : 'بانتظار توثيق الإدارة',
                                style: TextStyle(
                                  color: theme.colorScheme.onSurface.withOpacity(0.4),
                                  fontSize: 11,
                                  fontFamily: 'Cairo',
                                ),
                              ),
                            ],
                          ),
                        ),
                        if (!isCurrent)
                          IconButton(
                            icon: const Icon(Icons.link_off, color: Colors.redAccent, size: 20),
                            tooltip: 'فك ربط الجهاز',
                            onPressed: () => _confirmUnbindDevice(d),
                          ),
                      ],
                    ),
                  );
                }).toList(),
              );
            },
          ),
          const SizedBox(height: 4),
          Text(
            '* طبقاً لسياسة الحماية، يتم ربط حسابك بأجهزتك المسجلة. يمكنك فك ربط جهاز قديم لتسجيل جهاز جديد.',
            style: TextStyle(
              color: theme.colorScheme.onSurface.withOpacity(0.5),
              fontSize: 10,
              fontFamily: 'Cairo',
            ),
          ),
        ],
      ),
    );
  }

  void _confirmUnbindDevice(Map<String, dynamic> device) {
    showDialog(
      context: context,
      builder: (ctx) => Directionality(
        textDirection: TextDirection.rtl,
        child: AlertDialog(
          title: const Text('فك ربط الجهاز', style: TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.bold)),
          content: Text(
            'هل أنت متأكد من فك ربط الجهاز "${device['model'] ?? ''}"؟ لن يتمكن هذا الجهاز من مشاهدة المحاضرات بعد الآن.',
            style: const TextStyle(fontFamily: 'Cairo', fontSize: 13),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('إلغاء', style: TextStyle(fontFamily: 'Cairo', color: Colors.grey)),
            ),
            ElevatedButton(
              onPressed: () async {
                Navigator.pop(ctx);
                try {
                  await context.read<AuthBloc>().apiService.deleteDevice(device['id'].toString());
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('تم فك ربط الجهاز بنجاح', style: TextStyle(fontFamily: 'Cairo')),
                        backgroundColor: Colors.green,
                      ),
                    );
                    _loadSections();
                  }
                } catch (e) {
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text('فشل فك الربط: ${e.toString().replaceAll('DioException: ', '')}',
                            style: const TextStyle(fontFamily: 'Cairo')),
                        backgroundColor: Colors.redAccent,
                      ),
                    );
                  }
                }
              },
              style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent),
              child: const Text('فك الربط', style: TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.bold, color: Colors.white)),
            ),
          ],
        ),
      ),
    );
  }

  // ── Generic expansion section with async data ──
  Widget _buildExpansionSection({
    required String title,
    required IconData icon,
    required Future<Map<String, dynamic>>? future,
    required Widget Function(Map<String, dynamic> data) builder,
  }) {
    final theme = Theme.of(context);
    return Container(
      decoration: BoxDecoration(
        color: theme.cardTheme.color ?? theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: theme.colorScheme.onSurface.withOpacity(0.04)),
      ),
      child: Theme(
        data: theme.copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          leading: Icon(icon, color: AppTheme.primary, size: 22),
          title: Text(
            title,
            style: TextStyle(
              color: theme.colorScheme.onSurface,
              fontWeight: FontWeight.bold,
              fontSize: 14,
              fontFamily: 'Cairo',
            ),
          ),
          children: [
            FutureBuilder<Map<String, dynamic>>(
              future: future,
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Padding(
                    padding: EdgeInsets.all(20.0),
                    child: Center(child: AppLoadingIndicator(size: 24)),
                  );
                }
                if (snapshot.hasError || !snapshot.hasData) {
                  return Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Text(
                      'لا توجد بيانات متاحة',
                      style: TextStyle(
                        color: theme.colorScheme.onSurface.withOpacity(0.38),
                        fontSize: 12,
                        fontFamily: 'Cairo',
                      ),
                    ),
                  );
                }
                return builder(snapshot.data!);
              },
            ),
          ],
        ),
      ),
    );
  }

  // ── Quiz attempts list ──
  Widget _buildQuizAttemptsList(ThemeData theme, Map<String, dynamic> data) {
    final list = data['quiz_attempts'] as List? ?? [];
    if (list.isEmpty) {
      return Padding(
        padding: const EdgeInsets.all(16.0),
        child: Text(
          'لا توجد نتائج امتحانات مسجلة بعد',
          style: TextStyle(color: theme.colorScheme.onSurface.withOpacity(0.38), fontSize: 13, fontFamily: 'Cairo'),
        ),
      );
    }
    final isDark = theme.brightness == Brightness.dark;
    return ListView.separated(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: list.length,
      separatorBuilder: (_, __) => Divider(color: theme.colorScheme.onSurface.withOpacity(0.08), height: 1),
      itemBuilder: (context, idx) {
        final item = list[idx];
        DateTime? date;
        try {
          date = DateTime.parse(item['submitted_at'] ?? '').toLocal();
        } catch (_) {}
        final score = (item['score'] as num?)?.toDouble() ?? 0.0;
        final max = (item['max_score'] as num?)?.toDouble() ?? 100.0;
        final percent = max > 0 ? (score / max * 100).toStringAsFixed(0) : '0';
        final passColor = score >= max * 0.5
            ? (isDark ? Colors.greenAccent : Colors.green.shade700)
            : Colors.redAccent;

        return ListTile(
          leading: Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(color: passColor.withOpacity(0.1), shape: BoxShape.circle),
            child: Icon(Icons.star_outline, color: passColor, size: 22),
          ),
          title: Text(
            item['quiz_title'] ?? 'امتحان',
            style: TextStyle(
              color: theme.colorScheme.onSurface,
              fontSize: 13,
              fontWeight: FontWeight.bold,
              fontFamily: 'Cairo',
            ),
          ),
          subtitle: date != null
              ? Text(
                  'تاريخ التقديم: ${date.year}/${date.month}/${date.day}',
                  style: TextStyle(
                    color: theme.colorScheme.onSurface.withOpacity(0.4),
                    fontSize: 11,
                    fontFamily: 'Cairo',
                  ),
                )
              : null,
          trailing: Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                '$score / $max',
                style: TextStyle(color: theme.colorScheme.onSurface, fontWeight: FontWeight.bold, fontSize: 13),
              ),
              Text('%$percent', style: TextStyle(color: passColor, fontSize: 11, fontWeight: FontWeight.bold)),
            ],
          ),
        );
      },
    );
  }

  // ── Financials list ──
  Widget _buildFinancialsList(ThemeData theme, Map<String, dynamic> data) {
    final list = data['financials'] as List? ?? [];
    if (list.isEmpty) {
      return Padding(
        padding: const EdgeInsets.all(16.0),
        child: Text(
          'لا توجد تعاملات مالية مسجلة بعد',
          style: TextStyle(color: theme.colorScheme.onSurface.withOpacity(0.38), fontSize: 13, fontFamily: 'Cairo'),
        ),
      );
    }
    return ListView.separated(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: list.length,
      separatorBuilder: (_, __) => Divider(color: theme.colorScheme.onSurface.withOpacity(0.08), height: 1),
      itemBuilder: (context, idx) {
        final item = list[idx];
        final String typeStr = item['transaction_type'] == 'code_redeem'
            ? 'تفعيل كود'
            : item['transaction_type'] == 'manual_admin'
                ? 'يدوي من الإدارة'
                : 'دفع إلكتروني';
        DateTime? date;
        try {
          date = DateTime.parse(item['created_at'] ?? '').toLocal();
        } catch (_) {}
        final amount = (item['amount'] as num?) ?? 0;

        return ListTile(
          title: Text(
            item['course_title'] ?? 'تفعيل كورس',
            style: TextStyle(
              color: theme.colorScheme.onSurface,
              fontSize: 13,
              fontWeight: FontWeight.bold,
              fontFamily: 'Cairo',
            ),
          ),
          subtitle: Text(
            date != null ? '$typeStr • ${date.year}/${date.month}/${date.day}' : typeStr,
            style: TextStyle(
              color: theme.colorScheme.onSurface.withOpacity(0.4),
              fontSize: 11,
              fontFamily: 'Cairo',
            ),
          ),
          trailing: Text(
            '${(amount / 100).toStringAsFixed(0)} ج.م',
            style: const TextStyle(color: AppTheme.primary, fontWeight: FontWeight.bold, fontSize: 14),
          ),
        );
      },
    );
  }

  // ── Reset requests list ──
  Widget _buildResetRequestsList(ThemeData theme, Map<String, dynamic> data) {
    final list = data['reset_requests'] as List? ?? [];
    if (list.isEmpty) {
      return Padding(
        padding: const EdgeInsets.all(16.0),
        child: Text(
          'لا توجد طلبات فك ارتباط سابقة',
          style: TextStyle(color: theme.colorScheme.onSurface.withOpacity(0.38), fontSize: 13, fontFamily: 'Cairo'),
        ),
      );
    }
    final isDark = theme.brightness == Brightness.dark;
    return ListView.separated(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: list.length,
      separatorBuilder: (_, __) => Divider(color: theme.colorScheme.onSurface.withOpacity(0.08), height: 1),
      itemBuilder: (context, idx) {
        final item = list[idx];
        DateTime? date;
        try {
          date = DateTime.parse(item['created_at'] ?? '').toLocal();
        } catch (_) {}
        final status = item['status'] as String? ?? 'pending';
        String statusText = 'معلق';
        Color statusColor = isDark ? Colors.amberAccent : Colors.orange.shade700;
        if (status == 'approved') {
          statusText = 'مقبول';
          statusColor = isDark ? Colors.greenAccent : Colors.green.shade700;
        } else if (status == 'rejected') {
          statusText = 'مرفوض';
          statusColor = Colors.redAccent;
        }
        return ListTile(
          title: Text(
            item['reason'] ?? 'بدون سبب مذكور',
            style: TextStyle(
              color: theme.colorScheme.onSurface,
              fontSize: 13,
              fontWeight: FontWeight.bold,
              fontFamily: 'Cairo',
            ),
          ),
          subtitle: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (date != null)
                Text(
                  'تم التقديم: ${date.year}/${date.month}/${date.day}',
                  style: TextStyle(
                    color: theme.colorScheme.onSurface.withOpacity(0.4),
                    fontSize: 11,
                    fontFamily: 'Cairo',
                  ),
                ),
              if (status == 'rejected' && item['rejection_reason'] != null)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(
                    'سبب الرفض: ${item['rejection_reason']}',
                    style: const TextStyle(color: Colors.redAccent, fontSize: 11, fontFamily: 'Cairo'),
                  ),
                ),
            ],
          ),
          trailing: Text(
            statusText,
            style: TextStyle(color: statusColor, fontWeight: FontWeight.bold, fontSize: 13, fontFamily: 'Cairo'),
          ),
        );
      },
    );
  }

  // ── Avatar upload ──
  Future<void> _pickAndUploadAvatar() async {
    try {
      final ImagePicker picker = ImagePicker();
      final XFile? image = await picker.pickImage(
        source: ImageSource.gallery,
        maxWidth: 512,
        maxHeight: 512,
        imageQuality: 85,
      );
      if (image == null) return;

      final bytes = await image.readAsBytes();
      if (bytes.length > 2 * 1024 * 1024) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('حجم الصورة كبير جداً. الحد الأقصى المسموح به هو 2 ميجابايت.',
                style: TextStyle(fontFamily: 'Cairo')),
            backgroundColor: Colors.redAccent,
          ),
        );
        return;
      }

      if (!mounted) return;
      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (ctx) => const Center(
          child: Card(
            child: Padding(
              padding: EdgeInsets.all(24.0),
              child: AppLoadingIndicator(),
            ),
          ),
        ),
      );

      final response = await context.read<AuthBloc>().apiService.uploadAvatar(bytes);

      if (!mounted) return;
      Navigator.of(context).pop(); // dismiss loading dialog

      if (response != null && response['avatar_url'] != null) {
        context.read<AuthBloc>().add(AuthCheckRequested());
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('تم تحديث الصورة الشخصية بنجاح', style: TextStyle(fontFamily: 'Cairo')),
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        Navigator.of(context, rootNavigator: true).pop();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('فشل رفع الصورة: ${e.toString().replaceAll('DioException: ', '')}',
                style: const TextStyle(fontFamily: 'Cairo')),
            backgroundColor: Colors.redAccent,
          ),
        );
      }
    }
  }

  // ── Edit profile bottom sheet ──
  void _showEditProfileSheet(Map<String, dynamic> profile) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Directionality(
        textDirection: TextDirection.rtl,
        child: _EditProfileSheet(
          profile: profile,
          onSaved: () {
            context.read<AuthBloc>().add(AuthCheckRequested());
            _loadSections();
          },
        ),
      ),
    );
  }

  void _confirmLogout() {
    showDialog(
      context: context,
      builder: (ctx) => Directionality(
        textDirection: TextDirection.rtl,
        child: AlertDialog(
          title: const Text('تسجيل الخروج', style: TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.bold)),
          content: const Text('هل أنت متأكد من رغبتك في تسجيل الخروج؟', style: TextStyle(fontFamily: 'Cairo')),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('إلغاء', style: TextStyle(fontFamily: 'Cairo', color: Colors.grey)),
            ),
            TextButton(
              onPressed: () {
                Navigator.pop(ctx);
                context.read<AuthBloc>().add(AuthLoggedOut());
              },
              child: const Text(
                'تسجيل الخروج',
                style: TextStyle(fontFamily: 'Cairo', color: Colors.redAccent, fontWeight: FontWeight.bold),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Bottom sheet form for editing profile fields (grade/branch from public settings).
class _EditProfileSheet extends StatefulWidget {
  final Map<String, dynamic> profile;
  final VoidCallback onSaved;

  const _EditProfileSheet({required this.profile, required this.onSaved});

  @override
  State<_EditProfileSheet> createState() => _EditProfileSheetState();
}

class _EditProfileSheetState extends State<_EditProfileSheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameController;
  late final TextEditingController _phoneController;
  late final TextEditingController _parentPhoneController;

  List<String> _academicYears = [
    'الصف الأول الثانوي',
    'الصف الثاني الثانوي',
    'الصف الثالث الثانوي',
  ];
  List<String> _branches = [];
  late String _selectedGrade;
  late String _selectedBranch;
  late String _selectedGovernorate;
  bool _saving = false;

  static const List<String> _governorates = [
    'القاهرة', 'الجيزة', 'الإسكندرية', 'القليوبية', 'الدقهلية',
    'الشرقية', 'المنوفية', 'الغربية', 'البحيرة', 'دمياط',
    'كفر الشيخ', 'الفيوم', 'بني سويف', 'المنيا',
    'أسيوط', 'سوهاج', 'قنا', 'الأقصر', 'أسوان', 'البحر الأحمر',
    'الوادي الجديد', 'مطروح', 'شمال سيناء', 'جنوب سيناء', 'السويس', 'الإسماعيلية', 'بورسعيد',
  ];

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(text: widget.profile['full_name'] ?? '');
    _phoneController = TextEditingController(text: widget.profile['phone'] ?? '');
    _parentPhoneController = TextEditingController(text: widget.profile['parent_phone'] ?? '');
    _selectedGrade = widget.profile['grade'] ?? _academicYears.first;
    _selectedBranch = widget.profile['branch'] ?? 'عام';
    _selectedGovernorate = widget.profile['governorate'] ?? _governorates.first;
    _loadPublicSettings();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _parentPhoneController.dispose();
    super.dispose();
  }

  Future<void> _loadPublicSettings() async {
    try {
      final res = await context.read<AuthBloc>().apiService.getPublicSettings();
      if (!mounted) return;
      setState(() {
        final years = (res['academic_years'] as List?)?.cast<String>() ?? [];
        final branches = (res['branches'] as List?)?.cast<String>() ?? [];
        if (years.isNotEmpty) _academicYears = years;
        _branches = branches;
        if (!_academicYears.contains(_selectedGrade)) {
          _academicYears = [..._academicYears, _selectedGrade];
        }
        final specs = _specializationsForGrade(_selectedGrade);
        if (!specs.contains(_selectedBranch)) {
          _selectedBranch = specs.first;
        }
      });
    } catch (_) {}
  }

  /// Same allowed-branch filtering as student-web getSpecializations().
  List<String> _specializationsForGrade(String grade) {
    List<String> allowed;
    if (grade.contains('الأول')) {
      allowed = ['عام', 'أزهر'];
    } else if (grade.contains('الثاني')) {
      allowed = ['عام', 'أزهر', 'علمي', 'أدبي'];
    } else if (grade.contains('الثالث')) {
      allowed = ['عام', 'أزهر', 'علمي علوم', 'علمي رياضة', 'أدبي'];
    } else if (grade.toLowerCase().contains('ig')) {
      allowed = ['OL', 'AS', 'A-Level', 'علمي', 'أدبي'];
    } else {
      return _branches.isNotEmpty ? _branches : ['عام'];
    }

    if (_branches.isNotEmpty) {
      final filtered = _branches.where((b) => allowed.contains(b)).toList();
      return filtered.isNotEmpty ? filtered : ['عام'];
    }
    return allowed;
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      await context.read<AuthBloc>().apiService.updateProfile({
        'full_name': _nameController.text.trim(),
        'phone': _phoneController.text.trim(),
        'parent_phone': _parentPhoneController.text.trim(),
        'grade': _selectedGrade,
        'branch': _selectedBranch,
        'governorate': _selectedGovernorate,
      });
      if (!mounted) return;
      Navigator.of(context).pop();
      widget.onSaved();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('تم حفظ البيانات بنجاح', style: TextStyle(fontFamily: 'Cairo')),
          backgroundColor: Colors.green,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('فشل حفظ البيانات: ${e.toString().replaceAll('DioException: ', '')}',
              style: const TextStyle(fontFamily: 'Cairo')),
          backgroundColor: Colors.redAccent,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final specs = _specializationsForGrade(_selectedGrade);

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        decoration: BoxDecoration(
          color: isDark ? AppTheme.surfaceCard : Colors.white,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        ),
        padding: const EdgeInsets.fromLTRB(24, 16, 24, 24),
        child: Form(
          key: _formKey,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: isDark ? Colors.white24 : Colors.black12,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  'تعديل البيانات الشخصية',
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.bold,
                    color: theme.colorScheme.onSurface,
                    fontFamily: 'Cairo',
                  ),
                ),
                const SizedBox(height: 20),
                TextFormField(
                  controller: _nameController,
                  style: TextStyle(color: theme.colorScheme.onSurface, fontFamily: 'Cairo', fontSize: 14),
                  decoration: _decoration(theme, 'الاسم بالكامل', Icons.person_outline),
                  validator: (val) => val == null || val.trim().length < 5 ? 'يرجى إدخال الاسم بالكامل' : null,
                ),
                const SizedBox(height: 14),
                TextFormField(
                  controller: _phoneController,
                  keyboardType: TextInputType.phone,
                  style: TextStyle(color: theme.colorScheme.onSurface, fontFamily: 'Cairo', fontSize: 14),
                  decoration: _decoration(theme, 'رقم الهاتف الشخصي', Icons.phone_android_outlined),
                  validator: (val) {
                    if (val == null || val.trim().isEmpty) return 'يرجى إدخال رقم الهاتف';
                    if (!RegExp(r'^01[0125][0-9]{8}$').hasMatch(val.trim())) {
                      return 'يرجى إدخال رقم هاتف مصري صحيح';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 14),
                TextFormField(
                  controller: _parentPhoneController,
                  keyboardType: TextInputType.phone,
                  style: TextStyle(color: theme.colorScheme.onSurface, fontFamily: 'Cairo', fontSize: 14),
                  decoration: _decoration(theme, 'رقم ولي الأمر', Icons.family_restroom_outlined),
                  validator: (val) {
                    if (val == null || val.trim().isEmpty) return 'يرجى إدخال رقم ولي الأمر';
                    if (!RegExp(r'^01[0125][0-9]{8}$').hasMatch(val.trim())) {
                      return 'يرجى إدخال رقم هاتف مصري صحيح لولي الأمر';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 14),
                DropdownButtonFormField<String>(
                  value: _selectedGrade,
                  dropdownColor: isDark ? AppTheme.surfaceCard : Colors.white,
                  style: TextStyle(fontFamily: 'Cairo', color: theme.colorScheme.onSurface, fontSize: 14),
                  decoration: _decoration(theme, 'المرحلة الدراسية', Icons.calendar_today_outlined),
                  items: _academicYears
                      .map((grade) => DropdownMenuItem(value: grade, child: Text(grade)))
                      .toList(),
                  onChanged: (val) {
                    if (val != null) {
                      setState(() {
                        _selectedGrade = val;
                        final newSpecs = _specializationsForGrade(val);
                        if (!newSpecs.contains(_selectedBranch)) {
                          _selectedBranch = newSpecs.first;
                        }
                      });
                    }
                  },
                ),
                const SizedBox(height: 14),
                DropdownButtonFormField<String>(
                  value: specs.contains(_selectedBranch) ? _selectedBranch : specs.first,
                  dropdownColor: isDark ? AppTheme.surfaceCard : Colors.white,
                  style: TextStyle(fontFamily: 'Cairo', color: theme.colorScheme.onSurface, fontSize: 14),
                  decoration: _decoration(theme, 'الشعبة / التخصص', Icons.school_outlined),
                  items: specs.map((spec) => DropdownMenuItem(value: spec, child: Text(spec))).toList(),
                  onChanged: (val) {
                    if (val != null) setState(() => _selectedBranch = val);
                  },
                ),
                const SizedBox(height: 14),
                DropdownButtonFormField<String>(
                  value: _governorates.contains(_selectedGovernorate) ? _selectedGovernorate : _governorates.first,
                  dropdownColor: isDark ? AppTheme.surfaceCard : Colors.white,
                  style: TextStyle(fontFamily: 'Cairo', color: theme.colorScheme.onSurface, fontSize: 14),
                  decoration: _decoration(theme, 'المحافظة', Icons.map_outlined),
                  items: _governorates.map((gov) => DropdownMenuItem(value: gov, child: Text(gov))).toList(),
                  onChanged: (val) {
                    if (val != null) setState(() => _selectedGovernorate = val);
                  },
                ),
                const SizedBox(height: 22),
                ElevatedButton(
                  onPressed: _saving ? null : _save,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.primary,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: _saving
                      ? const AppLoadingIndicator(size: 20, color: Colors.white)
                      : const Text(
                          'حفظ التعديلات',
                          style: TextStyle(
                            fontFamily: 'Cairo',
                            fontWeight: FontWeight.bold,
                            fontSize: 14,
                            color: Colors.white,
                          ),
                        ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  InputDecoration _decoration(ThemeData theme, String label, IconData icon) {
    final isDark = theme.brightness == Brightness.dark;
    return InputDecoration(
      labelText: label,
      labelStyle: TextStyle(
        color: theme.colorScheme.onSurface.withOpacity(0.55),
        fontSize: 13,
        fontFamily: 'Cairo',
      ),
      prefixIcon: Icon(icon, color: AppTheme.primary, size: 18),
      filled: true,
      fillColor: isDark ? const Color(0xFF0F0F13) : const Color(0xFFF8FAFC),
      contentPadding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(
          color: isDark ? Colors.white.withOpacity(0.06) : const Color(0xFFE2E8F0),
        ),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: AppTheme.primary, width: 1.5),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: Colors.redAccent),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: Colors.redAccent, width: 1.5),
      ),
    );
  }
}
