import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:cached_network_image/cached_network_image.dart';

import '../blocs/auth/auth_bloc.dart';
import '../config/theme.dart';
import '../widgets/app_loading_indicator.dart';

/// Standalone exam screen.
/// - isPublic = true  -> free exam, no login required (/courses/public-exams)
/// - isPublic = false -> enrolled student exam with attempt tracking (/courses/exams)
class ExamScreen extends StatefulWidget {
  final String examId;
  final bool isPublic;

  const ExamScreen({
    super.key,
    required this.examId,
    this.isPublic = false,
  });

  @override
  State<ExamScreen> createState() => _ExamScreenState();
}

class _ExamScreenState extends State<ExamScreen> {
  bool _loading = true;
  String? _error;

  Map<String, dynamic>? _exam;
  List<dynamic> _questions = [];
  Map<String, dynamic>? _attempt;

  final Map<String, String> _answers = {};
  bool _started = false;
  bool _submitting = false;

  // Result state (after submit)
  Map<String, dynamic>? _result;

  // Countdown (authenticated exams with time limit)
  Timer? _countdownTimer;
  int? _secondsLeft;

  @override
  void initState() {
    super.initState();
    _loadExam();
  }

  @override
  void dispose() {
    _countdownTimer?.cancel();
    super.dispose();
  }

  Future<void> _loadExam() async {
    setState(() {
      _loading = true;
      _error = null;
      _result = null;
      _answers.clear();
      _started = false;
    });
    try {
      final apiService = context.read<AuthBloc>().apiService;
      final res = widget.isPublic
          ? await apiService.getPublicExamDetails(widget.examId)
          : await apiService.getExamDetails(widget.examId);

      if (!mounted) return;
      setState(() {
        _exam = res['exam'];
        _questions = res['questions'] as List<dynamic>? ?? [];
        _attempt = res['attempt'];
        _loading = false;
      });

      // Authenticated exam with an active timed attempt: resume countdown
      if (!widget.isPublic &&
          _exam != null &&
          _attempt != null &&
          _attempt!['is_submitted'] != 1) {
        _started = true;
        final startedAtStr = _attempt!['started_at'];
        final limitMins = _exam!['time_limit_mins'];
        if (startedAtStr != null && limitMins != null && limitMins > 0) {
          final startTime = DateTime.parse(startedAtStr).toLocal();
          final endTime = startTime.add(Duration(minutes: limitMins as int));
          _startCountdown(endTime);
        }
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString().replaceAll('DioException: ', '');
        _loading = false;
      });
    }
  }

  void _startCountdown(DateTime endTime) {
    _countdownTimer?.cancel();
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return;
      final remaining = endTime.difference(DateTime.now()).inSeconds;
      if (remaining <= 0) {
        setState(() => _secondsLeft = 0);
        _countdownTimer?.cancel();
        _submitExam(isTimeout: true);
      } else {
        setState(() => _secondsLeft = remaining);
      }
    });
  }

  String _formatTimeLeft(int seconds) {
    final mins = seconds ~/ 60;
    final secs = seconds % 60;
    return "$mins:${secs.toString().padLeft(2, '0')}";
  }

  Future<void> _submitExam({bool isTimeout = false}) async {
    if (_exam == null || _submitting) return;
    setState(() => _submitting = true);
    try {
      final apiService = context.read<AuthBloc>().apiService;
      final res = widget.isPublic
          ? await apiService.submitPublicExamAnswers(widget.examId, _answers)
          : await apiService.submitExamAnswers(widget.examId, _answers);

      _countdownTimer?.cancel();
      if (!mounted) return;
      setState(() {
        _result = res;
        _submitting = false;
      });

      if (isTimeout) {
        showDialog(
          context: context,
          builder: (ctx) => Directionality(
            textDirection: TextDirection.rtl,
            child: AlertDialog(
              title: const Text('انتهى الوقت!', style: TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.bold)),
              content: Text(
                'انتهى الوقت المحدد للامتحان. تم تسليم إجاباتك تلقائياً.\nدرجتك: ${res['score']} / ${res['max_score']}',
                style: const TextStyle(fontFamily: 'Cairo'),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(ctx).pop(),
                  child: const Text('حسناً', style: TextStyle(fontFamily: 'Cairo')),
                ),
              ],
            ),
          ),
        );
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _submitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('فشل تسليم الامتحان: ${e.toString().replaceAll('DioException: ', '')}',
              style: const TextStyle(fontFamily: 'Cairo')),
          backgroundColor: Colors.redAccent,
        ),
      );
    }
  }

  void _confirmSubmit() {
    final unanswered = _questions.length - _answers.length;
    showDialog(
      context: context,
      builder: (ctx) => Directionality(
        textDirection: TextDirection.rtl,
        child: AlertDialog(
          title: const Text('تسليم الامتحان', style: TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.bold)),
          content: Text(
            unanswered > 0
                ? 'لديك $unanswered سؤال بدون إجابة. هل أنت متأكد من التسليم؟ لا يمكن التعديل لاحقاً.'
                : 'هل أنت متأكد من تسليم إجاباتك؟ لا يمكن التعديل لاحقاً.',
            style: const TextStyle(fontFamily: 'Cairo'),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('تراجع', style: TextStyle(fontFamily: 'Cairo', color: Colors.grey)),
            ),
            ElevatedButton(
              onPressed: () {
                Navigator.of(ctx).pop();
                _submitExam();
              },
              style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primary),
              child: const Text('تأكيد التسليم', style: TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.bold, color: Colors.white)),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(
          _exam?['title'] ?? 'الامتحان',
          style: const TextStyle(fontSize: 16, fontFamily: 'Cairo', fontWeight: FontWeight.bold),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.of(context).canPop() ? Navigator.of(context).pop() : null,
        ),
        actions: [
          if (_secondsLeft != null && _result == null)
            Center(
              child: Container(
                margin: const EdgeInsets.only(left: 16),
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: (_secondsLeft! < 60 ? Colors.redAccent : AppTheme.primary).withOpacity(0.12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    Icon(Icons.timer, size: 16, color: _secondsLeft! < 60 ? Colors.redAccent : AppTheme.primary),
                    const SizedBox(width: 4),
                    Text(
                      _formatTimeLeft(_secondsLeft!),
                      style: TextStyle(
                        color: _secondsLeft! < 60 ? Colors.redAccent : AppTheme.primary,
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                      ),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
      body: _buildBody(theme),
    );
  }

  Widget _buildBody(ThemeData theme) {
    if (_loading) {
      return const Center(child: AppLoadingIndicator());
    }

    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, size: 48, color: Colors.redAccent),
              const SizedBox(height: 12),
              Text(
                _error!,
                textAlign: TextAlign.center,
                style: TextStyle(color: theme.colorScheme.onSurface.withOpacity(0.7), fontFamily: 'Cairo', fontSize: 14),
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: _loadExam,
                child: const Text('إعادة المحاولة', style: TextStyle(fontFamily: 'Cairo')),
              ),
            ],
          ),
        ),
      );
    }

    if (_exam == null) {
      return const Center(
        child: Text('الامتحان غير متاح', style: TextStyle(fontFamily: 'Cairo', color: Colors.grey)),
      );
    }

    // 1) Fresh submit result (public + authenticated)
    if (_result != null) {
      return _buildResultView(theme);
    }

    // 2) Previously submitted attempt (authenticated)
    if (!widget.isPublic && _attempt != null && _attempt!['is_submitted'] == 1) {
      return _buildSubmittedAttemptView(theme);
    }

    // 3) Intro panel before starting
    if (!_started) {
      return _buildIntroView(theme);
    }

    // 4) Taking the exam
    return _buildTakingView(theme);
  }

  // ── Intro panel: exam metadata + start button ──
  Widget _buildIntroView(ThemeData theme) {
    final coverImage = _exam?['cover_image'] as String? ?? '';
    final timeLimit = _exam?['time_limit_mins'];

    return SingleChildScrollView(
      padding: const EdgeInsets.all(20.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (coverImage.isNotEmpty)
            ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: CachedNetworkImage(
                imageUrl: coverImage,
                height: 180,
                width: double.infinity,
                fit: BoxFit.cover,
                placeholder: (_, __) => Container(height: 180, color: theme.colorScheme.onSurface.withOpacity(0.05)),
                errorWidget: (_, __, ___) => const SizedBox(),
              ),
            ),
          if (coverImage.isNotEmpty) const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: theme.cardTheme.color ?? theme.colorScheme.surface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: theme.colorScheme.onSurface.withOpacity(0.08)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (widget.isPublic)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.teal.withOpacity(0.12),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      'امتحان مجاني - بدون تسجيل',
                      style: TextStyle(
                        color: theme.brightness == Brightness.dark ? Colors.tealAccent : Colors.teal.shade700,
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        fontFamily: 'Cairo',
                      ),
                    ),
                  ),
                const SizedBox(height: 12),
                Text(
                  _exam?['title'] ?? '',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: theme.colorScheme.onSurface,
                    fontFamily: 'Cairo',
                  ),
                ),
                if (_exam?['course_title'] != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    'الكورس: ${_exam!['course_title']}',
                    style: TextStyle(
                      fontSize: 12,
                      color: theme.colorScheme.onSurface.withOpacity(0.5),
                      fontFamily: 'Cairo',
                    ),
                  ),
                ],
                Divider(color: theme.colorScheme.onSurface.withOpacity(0.08), height: 28),
                _buildInfoRow(theme, Icons.help_outline, 'عدد الأسئلة', '${_questions.length} سؤال'),
                const SizedBox(height: 10),
                _buildInfoRow(theme, Icons.star_outline, 'الدرجة النهائية', '${_exam?['max_score'] ?? 0} درجة'),
                if (timeLimit != null) ...[
                  const SizedBox(height: 10),
                  _buildInfoRow(theme, Icons.timer_outlined, 'الزمن المحدد', '$timeLimit دقيقة'),
                ],
              ],
            ),
          ),
          const SizedBox(height: 20),
          if (!widget.isPublic && timeLimit != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(
                'ملاحظة: بمجرد بدء الامتحان سيبدأ احتساب الوقت ولا يمكن إيقافه.',
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.orange.shade700,
                  fontFamily: 'Cairo',
                ),
                textAlign: TextAlign.center,
              ),
            ),
          ElevatedButton.icon(
            onPressed: () => setState(() => _started = true),
            icon: const Icon(Icons.play_arrow_rounded),
            label: const Text(
              'بدء حل الامتحان الآن',
              style: TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.bold, fontSize: 15),
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.primary,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoRow(ThemeData theme, IconData icon, String label, String value) {
    return Row(
      children: [
        Icon(icon, size: 18, color: AppTheme.primary),
        const SizedBox(width: 8),
        Text(
          label,
          style: TextStyle(
            fontSize: 13,
            color: theme.colorScheme.onSurface.withOpacity(0.6),
            fontFamily: 'Cairo',
          ),
        ),
        const Spacer(),
        Text(
          value,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.bold,
            color: theme.colorScheme.onSurface,
            fontFamily: 'Cairo',
          ),
        ),
      ],
    );
  }

  // ── Question list + submit ──
  Widget _buildTakingView(ThemeData theme) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'تمت الإجابة على ${_answers.length} من ${_questions.length} سؤال',
            style: TextStyle(
              fontSize: 12,
              color: theme.colorScheme.onSurface.withOpacity(0.5),
              fontFamily: 'Cairo',
            ),
          ),
          const SizedBox(height: 12),
          ...List.generate(_questions.length, (qIdx) {
            final q = _questions[qIdx];
            final questionText = q['question_text'] ?? '';
            final imageUrl = q['image_url'];
            final qId = q['id'].toString();
            final List<dynamic> options = q['options'] as List<dynamic>? ?? [];

            return Container(
              margin: const EdgeInsets.only(bottom: 16.0),
              padding: const EdgeInsets.all(16.0),
              decoration: BoxDecoration(
                color: theme.cardTheme.color ?? theme.colorScheme.surface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: theme.colorScheme.onSurface.withOpacity(0.06)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'س ${qIdx + 1}: ${questionText.isEmpty ? '(انظر الصورة)' : questionText}',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
                      fontFamily: 'Cairo',
                      color: theme.colorScheme.onSurface,
                    ),
                  ),
                  if (imageUrl != null && imageUrl.toString().isNotEmpty) ...[
                    const SizedBox(height: 10),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: CachedNetworkImage(
                        imageUrl: imageUrl.toString(),
                        height: 160,
                        width: double.infinity,
                        fit: BoxFit.contain,
                        placeholder: (_, __) => Container(color: theme.colorScheme.onSurface.withOpacity(0.05), height: 120),
                        errorWidget: (_, __, ___) => const SizedBox(),
                      ),
                    ),
                  ],
                  const SizedBox(height: 12),
                  ...options.map((opt) {
                    final optionText = opt.toString();
                    final isSelected = _answers[qId] == optionText;

                    return Container(
                      margin: const EdgeInsets.only(bottom: 8.0),
                      decoration: BoxDecoration(
                        color: isSelected ? AppTheme.primary.withOpacity(0.08) : Colors.transparent,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                          color: isSelected
                              ? AppTheme.primary.withOpacity(0.4)
                              : theme.colorScheme.onSurface.withOpacity(0.08),
                        ),
                      ),
                      child: RadioListTile<String>(
                        value: optionText,
                        groupValue: _answers[qId],
                        onChanged: (val) {
                          if (val != null) {
                            setState(() => _answers[qId] = val);
                          }
                        },
                        activeColor: AppTheme.primary,
                        dense: true,
                        title: Text(
                          optionText,
                          style: TextStyle(
                            fontSize: 13,
                            fontFamily: 'Cairo',
                            color: isSelected ? AppTheme.primary : theme.colorScheme.onSurface.withOpacity(0.85),
                            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                          ),
                        ),
                      ),
                    );
                  }),
                ],
              ),
            );
          }),
          const SizedBox(height: 8),
          ElevatedButton(
            onPressed: _answers.isEmpty || _submitting ? null : _confirmSubmit,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.primary,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: Text(
              _submitting ? 'جاري تصحيح الإجابات...' : 'تسليم الإجابات وعرض النتيجة',
              style: const TextStyle(fontFamily: 'Cairo', fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white),
            ),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  // ── Result view after fresh submission ──
  Widget _buildResultView(ThemeData theme) {
    final score = (_result?['score'] as num?)?.toDouble() ?? 0.0;
    final maxScore = (_result?['max_score'] as num?)?.toDouble() ?? 0.0;
    final passed = maxScore > 0 && score >= maxScore * 0.5;
    final passColor = passed
        ? (theme.brightness == Brightness.dark ? Colors.greenAccent : Colors.green.shade700)
        : Colors.redAccent;

    // Public exams: gradedQuestions map keyed by question id
    // Authenticated exams: graded list [{question_id, selected, correct, is_correct}]
    final Map<String, dynamic> gradedById = {};
    final gradedMap = _result?['gradedQuestions'];
    if (gradedMap is Map) {
      gradedMap.forEach((key, value) {
        gradedById[key.toString()] = {
          'is_correct': value['correct'] == true,
          'correct_option': value['correctOption'],
          'selected': value['chosenOption'],
        };
      });
    }
    final gradedList = _result?['graded'];
    if (gradedList is List) {
      for (final g in gradedList) {
        gradedById[(g['question_id'] ?? g['id']).toString()] = {
          'is_correct': g['is_correct'] == true,
          'correct_option': g['correct'] ?? g['correct_option'],
          'selected': g['selected'],
        };
      }
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(20.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
            decoration: BoxDecoration(
              color: theme.cardTheme.color ?? theme.colorScheme.surface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: passColor.withOpacity(0.3)),
            ),
            child: Column(
              children: [
                Icon(
                  passed ? Icons.emoji_events_outlined : Icons.sentiment_dissatisfied_outlined,
                  color: passColor,
                  size: 52,
                ),
                const SizedBox(height: 12),
                Text(
                  passed ? 'أحسنت! نتيجة رائعة' : 'تحتاج إلى مزيد من المذاكرة',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                    fontFamily: 'Cairo',
                    color: theme.colorScheme.onSurface,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'درجتك: $score / $maxScore',
                  style: TextStyle(color: passColor, fontWeight: FontWeight.bold, fontSize: 20, fontFamily: 'Cairo'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          Text(
            'مراجعة الإجابات',
            style: TextStyle(
              fontWeight: FontWeight.bold,
              fontSize: 15,
              fontFamily: 'Cairo',
              color: theme.colorScheme.onSurface,
            ),
          ),
          const SizedBox(height: 12),
          ...List.generate(_questions.length, (qIdx) {
            final q = _questions[qIdx];
            final qId = q['id'].toString();
            final graded = gradedById[qId];
            final isCorrect = graded?['is_correct'] == true;
            final selected = graded?['selected'] ?? _answers[qId];
            final correctOption = graded?['correct_option'];

            return Container(
              margin: const EdgeInsets.only(bottom: 12.0),
              padding: const EdgeInsets.all(14.0),
              decoration: BoxDecoration(
                color: theme.cardTheme.color ?? theme.colorScheme.surface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: (isCorrect ? Colors.green : Colors.redAccent).withOpacity(0.3),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(
                        isCorrect ? Icons.check_circle : Icons.cancel,
                        color: isCorrect ? Colors.green : Colors.redAccent,
                        size: 18,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'س ${qIdx + 1}: ${(q['question_text'] ?? '').toString().isEmpty ? '(سؤال بصورة)' : q['question_text']}',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 13,
                            fontFamily: 'Cairo',
                            color: theme.colorScheme.onSurface,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'إجابتك: ${selected ?? 'لم تتم الإجابة'}',
                    style: TextStyle(
                      fontSize: 12,
                      fontFamily: 'Cairo',
                      color: isCorrect ? Colors.green : Colors.redAccent,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  if (!isCorrect && correctOption != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Text(
                        'الإجابة الصحيحة: $correctOption',
                        style: const TextStyle(
                          fontSize: 12,
                          fontFamily: 'Cairo',
                          color: Colors.green,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                ],
              ),
            );
          }),
          const SizedBox(height: 8),
          if (widget.isPublic) ...[
            OutlinedButton.icon(
              onPressed: _loadExam,
              icon: const Icon(Icons.refresh),
              label: const Text('إعادة المحاولة', style: TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.bold)),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppTheme.primary,
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
            const SizedBox(height: 8),
          ],
          ElevatedButton(
            onPressed: () => Navigator.of(context).canPop() ? Navigator.of(context).pop() : null,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.primary,
              padding: const EdgeInsets.symmetric(vertical: 12),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: const Text('العودة', style: TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.bold, color: Colors.white)),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  // ── Previously submitted attempt (authenticated): score + chosen answers ──
  Widget _buildSubmittedAttemptView(ThemeData theme) {
    final score = (_attempt?['score'] as num?)?.toDouble() ?? 0.0;
    final maxScore = (_exam?['max_score'] as num?)?.toDouble() ?? 0.0;
    final passed = maxScore > 0 && score >= maxScore * 0.5;
    final passColor = passed
        ? (theme.brightness == Brightness.dark ? Colors.greenAccent : Colors.green.shade700)
        : Colors.redAccent;
    final attemptAnswers = _attempt?['answers'] as Map<dynamic, dynamic>? ?? {};

    return SingleChildScrollView(
      padding: const EdgeInsets.all(20.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
            decoration: BoxDecoration(
              color: theme.cardTheme.color ?? theme.colorScheme.surface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: passColor.withOpacity(0.3)),
            ),
            child: Column(
              children: [
                const Icon(Icons.check_circle_outline, color: Color(0xFF10B981), size: 48),
                const SizedBox(height: 12),
                Text(
                  'تم تسليم هذا الامتحان مسبقاً',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 15,
                    fontFamily: 'Cairo',
                    color: theme.colorScheme.onSurface,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'درجتك: $score / $maxScore',
                  style: TextStyle(color: passColor, fontWeight: FontWeight.bold, fontSize: 20, fontFamily: 'Cairo'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          Text(
            'إجاباتك المسجلة',
            style: TextStyle(
              fontWeight: FontWeight.bold,
              fontSize: 15,
              fontFamily: 'Cairo',
              color: theme.colorScheme.onSurface,
            ),
          ),
          const SizedBox(height: 12),
          ...List.generate(_questions.length, (qIdx) {
            final q = _questions[qIdx];
            final qId = q['id'].toString();
            final studentAns = attemptAnswers[qId];

            return Container(
              margin: const EdgeInsets.only(bottom: 12.0),
              padding: const EdgeInsets.all(14.0),
              decoration: BoxDecoration(
                color: theme.cardTheme.color ?? theme.colorScheme.surface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: theme.colorScheme.onSurface.withOpacity(0.06)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'س ${qIdx + 1}: ${(q['question_text'] ?? '').toString().isEmpty ? '(سؤال بصورة)' : q['question_text']}',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 13,
                      fontFamily: 'Cairo',
                      color: theme.colorScheme.onSurface,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'إجابتك: ${studentAns ?? 'لم تتم الإجابة'}',
                    style: TextStyle(
                      fontSize: 12,
                      fontFamily: 'Cairo',
                      color: studentAns != null ? AppTheme.primary : Colors.redAccent,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }
}
