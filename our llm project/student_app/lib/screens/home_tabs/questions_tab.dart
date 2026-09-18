import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:cached_network_image/cached_network_image.dart';

import '../../blocs/auth/auth_bloc.dart';
import '../../config/theme.dart';
import '../../widgets/app_loading_indicator.dart';
import 'home_widgets.dart';

/// Q&A tab: ask questions and browse answers (search + status filter, web parity).
class QuestionsTab extends StatefulWidget {
  final Map<String, dynamic>? profile; // null => guest

  const QuestionsTab({super.key, required this.profile});

  @override
  State<QuestionsTab> createState() => _QuestionsTabState();
}

class _QuestionsTabState extends State<QuestionsTab> {
  Future<Map<String, dynamic>>? _questionsFuture;
  final _searchController = TextEditingController();
  String _searchQuery = '';
  String _statusFilter = 'all'; // all | answered | pending

  bool get _isGuest => widget.profile == null;

  @override
  void initState() {
    super.initState();
    if (!_isGuest) _loadQuestions();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _loadQuestions() {
    setState(() {
      _questionsFuture = context.read<AuthBloc>().apiService.getQuestions();
    });
  }

  Future<void> _refresh() async => _loadQuestions();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    if (_isGuest) {
      return const Column(
        children: [
          TabHeader(title: 'الأسئلة والاستفسارات', isGuest: true),
          Expanded(
            child: LoginPromptView(
              title: 'اسأل المدرس مباشرة بعد تسجيل الدخول',
              description: 'منتدى الأسئلة متاح للطلاب المسجلين فقط. سجّل دخولك لطرح أسئلتك ومتابعة الردود.',
              icon: Icons.question_answer_outlined,
            ),
          ),
        ],
      );
    }

    return Column(
      children: [
        const TabHeader(title: 'الأسئلة والاستفسارات', isGuest: false),

        // Ask question CTA
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 8.0),
          child: GestureDetector(
            onTap: _showAskQuestionDialog,
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
              decoration: BoxDecoration(
                color: AppTheme.primary,
                borderRadius: BorderRadius.circular(12),
                boxShadow: [
                  BoxShadow(
                    color: AppTheme.primary.withOpacity(0.2),
                    blurRadius: 8,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.add_comment_outlined, color: Colors.white, size: 20),
                  SizedBox(width: 10),
                  Text(
                    'طرح سؤال جديد',
                    style: TextStyle(
                      fontFamily: 'Cairo',
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 15,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),

        // Search + status filter
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 4.0),
          child: Column(
            children: [
              TextFormField(
                controller: _searchController,
                style: TextStyle(fontFamily: 'Cairo', color: theme.colorScheme.onSurface, fontSize: 13),
                decoration: InputDecoration(
                  hintText: 'ابحث عن سؤال أو كلمة مفتاحية...',
                  hintStyle: TextStyle(
                    fontFamily: 'Cairo',
                    color: theme.colorScheme.onSurface.withOpacity(0.4),
                    fontSize: 12,
                  ),
                  prefixIcon: Icon(Icons.search, color: theme.colorScheme.onSurface.withOpacity(0.4), size: 20),
                  filled: true,
                  fillColor: isDark ? Colors.white.withOpacity(0.04) : Colors.black.withOpacity(0.04),
                  contentPadding: const EdgeInsets.symmetric(vertical: 6),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(24),
                    borderSide: BorderSide.none,
                  ),
                ),
                onChanged: (val) => setState(() => _searchQuery = val.trim().toLowerCase()),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  _buildFilterChip(theme, 'الكل', 'all'),
                  const SizedBox(width: 8),
                  _buildFilterChip(theme, 'تمت الإجابة', 'answered'),
                  const SizedBox(width: 8),
                  _buildFilterChip(theme, 'قيد الانتظار', 'pending'),
                ],
              ),
            ],
          ),
        ),

        const SizedBox(height: 8),

        Expanded(
          child: RefreshIndicator(
            onRefresh: _refresh,
            color: AppTheme.primary,
            child: FutureBuilder<Map<String, dynamic>>(
              future: _questionsFuture,
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Center(child: AppLoadingIndicator());
                }

                var questions = snapshot.data?['questions'] as List? ?? [];

                // Apply filters
                questions = questions.where((q) {
                  final body = (q['body'] as String? ?? '').toLowerCase();
                  final status = q['status'] as String? ?? '';
                  final matchesSearch = _searchQuery.isEmpty || body.contains(_searchQuery);
                  final matchesStatus = _statusFilter == 'all' ||
                      (_statusFilter == 'answered' && status == 'answered') ||
                      (_statusFilter == 'pending' && status != 'answered');
                  return matchesSearch && matchesStatus;
                }).toList();

                if (snapshot.hasError || questions.isEmpty) {
                  return ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    children: [
                      const SizedBox(height: 80),
                      TabEmptyState(
                        icon: Icons.forum_outlined,
                        message: _searchQuery.isNotEmpty || _statusFilter != 'all'
                            ? 'لا توجد نتائج تطابق بحثك الحالي'
                            : 'لم تقم بالاستفسار عن أي أسئلة حتى الآن.\nكن أول من يطرح سؤالاً!',
                      ),
                    ],
                  );
                }

                return ListView.builder(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                  itemCount: questions.length,
                  itemBuilder: (context, index) => _buildQuestionCard(theme, isDark, questions[index]),
                );
              },
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildFilterChip(ThemeData theme, String label, String value) {
    final bool selected = _statusFilter == value;
    return GestureDetector(
      onTap: () => setState(() => _statusFilter = value),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: selected ? AppTheme.primary : theme.colorScheme.onSurface.withOpacity(0.04),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontFamily: 'Cairo',
            fontSize: 11,
            fontWeight: selected ? FontWeight.bold : FontWeight.normal,
            color: selected ? Colors.white : theme.colorScheme.onSurface.withOpacity(0.6),
          ),
        ),
      ),
    );
  }

  Widget _buildQuestionCard(ThemeData theme, bool isDark, Map<String, dynamic> q) {
    final answers = q['answers'] as List?;
    final bool hasAnswer = (answers != null && answers.isNotEmpty) || q['status'] == 'answered';
    final statusText = q['status'] == 'answered' ? 'تمت الإجابة' : 'قيد الانتظار';
    final Color badgeColor = q['status'] == 'answered' ? const Color(0xFF10B981) : const Color(0xFFF59E0B);
    DateTime? createdAt;
    try {
      createdAt = DateTime.parse(q['created_at'] ?? '').toLocal();
    } catch (_) {}

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: theme.cardTheme.color ?? theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: theme.colorScheme.onSurface.withOpacity(0.08)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: badgeColor.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  statusText,
                  style: TextStyle(
                    color: badgeColor,
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    fontFamily: 'Cairo',
                  ),
                ),
              ),
              if (createdAt != null)
                Text(
                  '${createdAt.year}/${createdAt.month}/${createdAt.day}',
                  style: TextStyle(
                    color: theme.colorScheme.onSurface.withOpacity(0.3),
                    fontSize: 11,
                    fontFamily: 'Cairo',
                  ),
                ),
            ],
          ),
          if (q['lesson_title'] != null) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: AppTheme.primary.withOpacity(0.05),
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: AppTheme.primary.withOpacity(0.15)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.play_circle_outline, size: 12, color: AppTheme.primary),
                  const SizedBox(width: 4),
                  Flexible(
                    child: Text(
                      'درس: ${q['lesson_title']}',
                      style: TextStyle(
                        fontSize: 11,
                        color: theme.colorScheme.onSurface.withOpacity(0.6),
                        fontWeight: FontWeight.bold,
                        fontFamily: 'Cairo',
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 10),
          Text(
            q['body'] ?? '',
            style: TextStyle(
              color: theme.colorScheme.onSurface,
              fontSize: 13,
              fontFamily: 'Cairo',
              height: 1.6,
            ),
          ),
          if (hasAnswer && answers != null && answers.isNotEmpty) ...[
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: isDark ? Colors.white.withOpacity(0.02) : Colors.black.withOpacity(0.02),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: theme.colorScheme.onSurface.withOpacity(0.04)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.support_agent, color: AppTheme.primary, size: 16),
                      const SizedBox(width: 6),
                      Text(
                        'إجابة الدعم التعليمي:',
                        style: TextStyle(
                          fontFamily: 'Cairo',
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          color: theme.colorScheme.onSurface.withOpacity(0.7),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  ...answers.map((ans) {
                        final String? ansImageUrl = ans['image_url'];
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                ans['body'] ?? '',
                                style: TextStyle(
                                  fontFamily: 'Cairo',
                                  fontSize: 12,
                                  color: theme.colorScheme.onSurface.withOpacity(0.8),
                                  height: 1.6,
                                ),
                              ),
                              if (ansImageUrl != null && ansImageUrl.isNotEmpty) ...[
                                const SizedBox(height: 6),
                                ClipRRect(
                                  borderRadius: BorderRadius.circular(6),
                                  child: CachedNetworkImage(
                                    imageUrl: ansImageUrl,
                                    maxHeightDiskCache: 600,
                                    fit: BoxFit.contain,
                                    placeholder: (_, __) => Container(color: Colors.white10, height: 100),
                                    errorWidget: (_, __, ___) => const Icon(Icons.broken_image, size: 16),
                                  ),
                                ),
                              ],
                            ],
                          ),
                        );
                      }),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  void _showAskQuestionDialog() {
    final controller = TextEditingController();
    final formKey = GlobalKey<FormState>();
    bool loading = false;

    showDialog(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (dialogContext, setDialogState) {
            final isDark = Theme.of(dialogContext).brightness == Brightness.dark;
            return Directionality(
              textDirection: TextDirection.rtl,
              child: AlertDialog(
                backgroundColor: isDark ? AppTheme.surfaceCard : Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                title: Text(
                  'طرح سؤال جديد 🙋‍♂️',
                  style: TextStyle(
                    fontFamily: 'Cairo',
                    color: isDark ? Colors.white : Colors.black87,
                    fontWeight: FontWeight.bold,
                    fontSize: 18,
                  ),
                ),
                content: Form(
                  key: formKey,
                  child: TextFormField(
                    controller: controller,
                    style: TextStyle(
                      color: isDark ? Colors.white : Colors.black87,
                      fontFamily: 'Cairo',
                      fontSize: 14,
                    ),
                    maxLines: 4,
                    decoration: InputDecoration(
                      hintText: 'اكتب سؤالك هنا بالتفصيل ليقوم المدرس أو المساعدين بالإجابة عليه...',
                      hintStyle: TextStyle(color: isDark ? Colors.white38 : Colors.black38, fontSize: 12),
                      filled: true,
                      fillColor: isDark ? Colors.white.withOpacity(0.04) : Colors.black.withOpacity(0.04),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    validator: (val) => val == null || val.trim().isEmpty ? 'يرجى كتابة السؤال أولاً' : null,
                  ),
                ),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.of(ctx).pop(),
                    child: Text(
                      'إلغاء',
                      style: TextStyle(fontFamily: 'Cairo', color: isDark ? Colors.white38 : Colors.black38),
                    ),
                  ),
                  ElevatedButton(
                    onPressed: loading
                        ? null
                        : () async {
                            if (!formKey.currentState!.validate()) return;
                            setDialogState(() => loading = true);
                            try {
                              await context.read<AuthBloc>().apiService.askQuestion(body: controller.text.trim());
                              if (ctx.mounted) Navigator.of(ctx).pop();
                              if (mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text('تم إرسال سؤالك بنجاح وقيد المراجعة.',
                                        style: TextStyle(fontFamily: 'Cairo')),
                                    backgroundColor: Colors.green,
                                  ),
                                );
                                _loadQuestions();
                              }
                            } catch (e) {
                              setDialogState(() => loading = false);
                              if (mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                    content: Text(
                                        'فشل إرسال السؤال: ${e.toString().replaceAll('DioException: ', '')}',
                                        style: const TextStyle(fontFamily: 'Cairo')),
                                    backgroundColor: Colors.redAccent,
                                  ),
                                );
                              }
                            }
                          },
                    style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primary),
                    child: loading
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: AppLoadingIndicator(size: 16, color: Colors.white),
                          )
                        : const Text(
                            'إرسال السؤال',
                            style: TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.bold),
                          ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }
}
