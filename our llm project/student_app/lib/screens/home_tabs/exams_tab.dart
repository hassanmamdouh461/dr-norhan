import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:cached_network_image/cached_network_image.dart';

import '../../blocs/auth/auth_bloc.dart';
import '../../config/theme.dart';
import '../../widgets/app_loading_indicator.dart';
import '../exam_screen.dart';
import 'home_widgets.dart';

/// Exams tab.
/// - Authenticated: standalone platform exams with attempt status (web parity).
/// - Guest: free public exams that can be solved without an account.
class ExamsTab extends StatefulWidget {
  final Map<String, dynamic>? profile; // null => guest

  const ExamsTab({super.key, required this.profile});

  @override
  State<ExamsTab> createState() => _ExamsTabState();
}

class _ExamsTabState extends State<ExamsTab> {
  Future<Map<String, dynamic>>? _examsFuture;

  bool get _isGuest => widget.profile == null;

  @override
  void initState() {
    super.initState();
    _loadExams();
  }

  void _loadExams() {
    final apiService = context.read<AuthBloc>().apiService;
    setState(() {
      _examsFuture = _isGuest ? apiService.getPublicExams() : apiService.getExams();
    });
  }

  Future<void> _refresh() async => _loadExams();

  void _openExam(Map<String, dynamic> exam) {
    Navigator.of(context)
        .push(MaterialPageRoute(
          builder: (_) => ExamScreen(examId: exam['id'], isPublic: _isGuest),
        ))
        .then((_) => _loadExams());
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Column(
      children: [
        TabHeader(title: 'الامتحانات والتقييمات', isGuest: _isGuest),
        if (_isGuest)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 4.0),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.teal.withOpacity(0.08),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.teal.withOpacity(0.2)),
              ),
              child: Text(
                'هذه امتحانات مجانية يمكنك حلها بدون تسجيل. سجّل دخولك للوصول لجميع امتحانات كورساتك وحفظ نتائجك.',
                style: TextStyle(
                  fontSize: 12,
                  color: theme.brightness == Brightness.dark ? Colors.tealAccent : Colors.teal.shade800,
                  fontFamily: 'Cairo',
                  height: 1.5,
                ),
              ),
            ),
          ),
        Expanded(
          child: RefreshIndicator(
            onRefresh: _refresh,
            color: AppTheme.primary,
            child: FutureBuilder<Map<String, dynamic>>(
              future: _examsFuture,
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Center(child: AppLoadingIndicator());
                }

                if (snapshot.hasError) {
                  return ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    children: [
                      const SizedBox(height: 80),
                      TabEmptyState(
                        icon: Icons.wifi_off_rounded,
                        message: 'فشل تحميل الامتحانات: ${snapshot.error.toString().replaceAll('DioException: ', '')}',
                      ),
                      const SizedBox(height: 12),
                      Center(
                        child: ElevatedButton(
                          onPressed: _loadExams,
                          child: const Text('إعادة المحاولة', style: TextStyle(fontFamily: 'Cairo')),
                        ),
                      ),
                    ],
                  );
                }

                final exams = snapshot.data?['exams'] as List? ?? [];
                if (exams.isEmpty) {
                  return ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    children: const [
                      SizedBox(height: 100),
                      TabEmptyState(
                        icon: Icons.assignment_outlined,
                        message: 'لا توجد امتحانات متاحة حالياً.\nسيتم إشعارك عند إضافة امتحانات جديدة.',
                      ),
                    ],
                  );
                }

                return ListView.builder(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                  itemCount: exams.length,
                  itemBuilder: (context, index) => _buildExamCard(theme, exams[index]),
                );
              },
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildExamCard(ThemeData theme, Map<String, dynamic> exam) {
    final isDark = theme.brightness == Brightness.dark;
    final coverImage = exam['cover_image'] as String? ?? '';
    final bool hasAttempt = exam['is_submitted'] == 1;
    final double studentScore = (exam['student_score'] as num?)?.toDouble() ?? 0.0;
    final double maxScore = (exam['max_score'] as num?)?.toDouble() ?? 0.0;
    final bool isPassed = maxScore > 0 && studentScore >= maxScore * 0.5;
    final int scorePercentage = maxScore > 0 ? ((studentScore / maxScore) * 100).round() : 0;

    // Access window state
    final now = DateTime.now();
    DateTime? startTime;
    DateTime? endTime;
    try {
      if (exam['start_time'] != null) startTime = DateTime.parse(exam['start_time']).toLocal();
      if (exam['end_time'] != null) endTime = DateTime.parse(exam['end_time']).toLocal();
    } catch (_) {}
    final bool notStarted = startTime != null && now.isBefore(startTime);
    final bool expired = endTime != null && now.isAfter(endTime) && !hasAttempt;

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: theme.cardTheme.color ?? theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: theme.colorScheme.onSurface.withOpacity(0.08)),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (coverImage.isNotEmpty)
            CachedNetworkImage(
              imageUrl: coverImage,
              height: 120,
              width: double.infinity,
              fit: BoxFit.cover,
              placeholder: (_, __) => Container(height: 120, color: theme.colorScheme.onSurface.withOpacity(0.05)),
              errorWidget: (_, __, ___) => const SizedBox(),
            ),
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    if (exam['course_title'] != null)
                      Flexible(
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: AppTheme.primary.withOpacity(0.08),
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(color: AppTheme.primary.withOpacity(0.15)),
                          ),
                          child: Text(
                            exam['course_title'],
                            style: const TextStyle(
                              color: AppTheme.primary,
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              fontFamily: 'Cairo',
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ),
                    const SizedBox(width: 8),
                    if (_isGuest)
                      _buildBadge(
                        text: 'مجاني',
                        color: isDark ? Colors.tealAccent : Colors.teal.shade700,
                        bgColor: Colors.teal.withOpacity(0.1),
                      )
                    else if (hasAttempt)
                      _buildBadge(
                        text: 'تم الحل: $scorePercentage%',
                        color: isPassed ? const Color(0xFF10B981) : Colors.redAccent,
                        bgColor: (isPassed ? const Color(0xFF10B981) : Colors.redAccent).withOpacity(0.1),
                        icon: isPassed ? Icons.check_circle : Icons.cancel,
                      )
                    else if (notStarted)
                      _buildBadge(
                        text: 'لم يبدأ بعد',
                        color: Colors.blueAccent,
                        bgColor: Colors.blueAccent.withOpacity(0.1),
                        icon: Icons.schedule,
                      )
                    else if (expired)
                      _buildBadge(
                        text: 'انتهى الوقت',
                        color: Colors.grey,
                        bgColor: Colors.grey.withOpacity(0.12),
                        icon: Icons.timer_off_outlined,
                      )
                    else
                      _buildBadge(
                        text: 'مطلوب حله',
                        color: const Color(0xFFF59E0B),
                        bgColor: const Color(0xFFF59E0B).withOpacity(0.1),
                      ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  exam['title'] ?? 'امتحان',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: theme.colorScheme.onSurface,
                    fontFamily: 'Cairo',
                    height: 1.5,
                  ),
                ),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 12,
                  children: [
                    Text(
                      'الدرجة الكلية: ${exam['max_score'] ?? 0} درجة',
                      style: TextStyle(
                        fontSize: 12,
                        color: theme.colorScheme.onSurface.withOpacity(0.55),
                        fontFamily: 'Cairo',
                      ),
                    ),
                    if (exam['time_limit_mins'] != null)
                      Text(
                        'الزمن: ${exam['time_limit_mins']} دقيقة',
                        style: TextStyle(
                          fontSize: 12,
                          color: theme.colorScheme.onSurface.withOpacity(0.55),
                          fontFamily: 'Cairo',
                        ),
                      ),
                  ],
                ),
                if (notStarted) ...[
                  const SizedBox(height: 6),
                  Text(
                    'يبدأ في: ${startTime.year}/${startTime.month}/${startTime.day} - ${startTime.hour.toString().padLeft(2, '0')}:${startTime.minute.toString().padLeft(2, '0')}',
                    style: const TextStyle(fontSize: 11, color: Colors.blueAccent, fontFamily: 'Cairo'),
                  ),
                ],
                Divider(color: theme.colorScheme.onSurface.withOpacity(0.08), height: 28),
                if (hasAttempt && !_isGuest)
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text.rich(
                        TextSpan(
                          text: 'درجتك: ',
                          style: TextStyle(
                            fontSize: 12,
                            color: theme.colorScheme.onSurface.withOpacity(0.55),
                            fontFamily: 'Cairo',
                          ),
                          children: [
                            TextSpan(
                              text: '$studentScore / $maxScore',
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.bold,
                                color: isPassed ? const Color(0xFF10B981) : Colors.redAccent,
                              ),
                            ),
                          ],
                        ),
                      ),
                      OutlinedButton(
                        onPressed: () => _openExam(exam),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppTheme.primary,
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                        ),
                        child: const Text(
                          'عرض الإجابات',
                          style: TextStyle(fontFamily: 'Cairo', fontSize: 12, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                  )
                else
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: (notStarted || expired) ? null : () => _openExam(exam),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.primary,
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      child: Text(
                        notStarted
                            ? 'الامتحان لم يبدأ بعد'
                            : expired
                                ? 'انتهى وقت الامتحان'
                                : 'بدء حل الامتحان الآن',
                        style: const TextStyle(
                          fontFamily: 'Cairo',
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBadge({
    required String text,
    required Color color,
    required Color bgColor,
    IconData? icon,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withOpacity(0.25)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 13, color: color),
            const SizedBox(width: 4),
          ],
          Text(
            text,
            style: TextStyle(
              color: color,
              fontSize: 11,
              fontWeight: FontWeight.bold,
              fontFamily: 'Cairo',
            ),
          ),
        ],
      ),
    );
  }
}
