import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../blocs/auth/auth_bloc.dart';
import '../../blocs/course/course_bloc.dart';
import '../../blocs/course/course_event.dart';
import '../../blocs/course/course_state.dart';
import '../../blocs/theme/theme_bloc.dart';
import '../../config/theme.dart';
import '../../widgets/course_card.dart';
import '../../widgets/resume_learning_card.dart';
import '../../widgets/empty_state.dart';
import '../exam_screen.dart';
import 'home_widgets.dart';

/// Dashboard home tab — works for guests and authenticated students.
class HomeTab extends StatefulWidget {
  final Map<String, dynamic>? profile; // null => guest

  const HomeTab({super.key, required this.profile});

  @override
  State<HomeTab> createState() => _HomeTabState();
}

class _HomeTabState extends State<HomeTab> {
  Map<String, dynamic>? _lastWatchedLesson;
  Future<Map<String, dynamic>>? _statsFuture;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  void _loadData() {
    final apiService = context.read<AuthBloc>().apiService;
    _loadLastWatchedLesson();
    _statsFuture = Future.wait([
      apiService.getMyQuizAttempts(),
      apiService.getQuestions(),
    ]).then((results) {
      return {
        'quizzes_count': (results[0]['quiz_attempts'] as List?)?.length ?? 0,
        'questions_count': (results[1]['questions'] as List?)?.length ?? 0,
      };
    }).catchError((_) => {'quizzes_count': 0, 'questions_count': 0});
  }

  void _loadLastWatchedLesson() async {
    try {
      final logsRes = await context.read<AuthBloc>().apiService.getMyPlaybackLogs();
      final logs = logsRes['logs'] as List? ?? logsRes['playback_logs'] as List?;
      if (!mounted) return;
      setState(() {
        _lastWatchedLesson = (logs != null && logs.isNotEmpty) ? Map<String, dynamic>.from(logs.first) : null;
      });
    } catch (_) {}
  }

  Future<void> _refresh() async {
    final grade = widget.profile?['grade'];
    context.read<CourseBloc>().add(FetchCoursesRequested(grade: grade));
    setState(_loadData);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return RefreshIndicator(
      onRefresh: _refresh,
      color: AppTheme.primary,
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          SliverAppBar(
            toolbarHeight: 80.0,
            pinned: true,
            backgroundColor: theme.scaffoldBackgroundColor,
            elevation: 0,
            automaticallyImplyLeading: false,
            titleSpacing: 0,
            title: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16.0),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Builder(
                        builder: (ctx) => IconButton(
                          icon: Icon(Icons.menu, color: theme.colorScheme.onSurface, size: 28),
                          onPressed: () => Scaffold.of(ctx).openDrawer(),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'أهلاً بك 👋',
                            style: TextStyle(
                              fontSize: 11,
                              color: theme.colorScheme.onSurface.withOpacity(0.6),
                              fontFamily: 'Cairo',
                            ),
                          ),
                          Text(
                            _isGuest ? 'زائر' : (widget.profile?['full_name'] ?? 'الطالب'),
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                              color: theme.colorScheme.onSurface,
                              fontFamily: 'Cairo',
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  Row(
                    children: [
                      IconButton(
                        icon: Icon(
                          isDark ? Icons.light_mode_outlined : Icons.dark_mode_outlined,
                          color: theme.colorScheme.onSurface,
                          size: 26,
                        ),
                        onPressed: () => context.read<ThemeBloc>().add(ToggleThemeEvent()),
                      ),
                      IconButton(
                        icon: Icon(Icons.notifications_outlined, color: theme.colorScheme.onSurface, size: 26),
                        onPressed: () => showNotificationsSheet(context, isGuest: false),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),

          // ── Authenticated Student View ──
            if (_lastWatchedLesson != null)
              SliverToBoxAdapter(child: ResumeLearningCard(lastLesson: _lastWatchedLesson!)),
            SliverToBoxAdapter(child: _buildStatsGrid(theme)),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
                child: Text(
                  'أقسام المنصة',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: theme.colorScheme.onSurface,
                    fontFamily: 'Cairo',
                  ),
                ),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 8.0),
              sliver: SliverGrid(
                // Extent-based grid adapts from narrow (320dp) to large phones/tablets
                gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                  maxCrossAxisExtent: 240,
                  crossAxisSpacing: 12,
                  mainAxisSpacing: 12,
                  mainAxisExtent: 62,
                ),
                delegate: SliverChildListDelegate([
                  _buildShortcutCard(
                    title: 'الدورات التعليمية',
                    icon: Icons.school_outlined,
                    color: FushaColors.teal800,
                    route: '/courses',
                  ),
                  _buildShortcutCard(
                    title: 'كورساتي',
                    icon: Icons.menu_book_outlined,
                    color: FushaColors.teal500,
                    route: '/my-courses',
                  ),
                  _buildShortcutCard(
                    title: 'الامتحانات',
                    icon: Icons.assignment_outlined,
                    color: FushaColors.gold500,
                    route: '/exams',
                  ),
                  _buildShortcutCard(
                    title: 'الأسئلة والاستفسارات',
                    icon: Icons.question_answer_outlined,
                    color: FushaColors.sage500,
                    route: '/questions',
                  ),
                ]),
              ),
            ),
            // My Courses horizontal
            SliverToBoxAdapter(child: _buildMyCoursesSection(theme)),
            // Suggested courses
            SliverToBoxAdapter(child: _buildSuggestedSection(theme)),
            // Fusha Daily Literary Wisdom Card (Amiri font)
            SliverToBoxAdapter(child: _buildWisdomCard(theme)),
            const SliverToBoxAdapter(child: SizedBox(height: 32)),
          ],
        ),
      );
  }

  Widget _buildWisdomCard(ThemeData theme) {
    return Container(
      margin: const EdgeInsets.fromLTRB(20, 16, 20, 8),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      decoration: BoxDecoration(
        color: FushaColors.canvasDark,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: FushaColors.gold500.withValues(alpha: 0.25), width: 1),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.auto_awesome, color: FushaColors.gold500, size: 16),
              const SizedBox(width: 8),
              Text(
                'دُرّةُ فُصْحَى اليوميّة',
                style: GoogleFonts.cairo(
                  color: FushaColors.gold500,
                  fontWeight: FontWeight.bold,
                  fontSize: 12.5,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            '« لُغَةٌ إِذا وَقَعَت عَلَى أَسماعِنا .. كانَت لَنا بَرداً عَلى الأَكبادِ »',
            style: GoogleFonts.amiri(
              color: Colors.white,
              fontSize: 16,
              height: 1.6,
              fontWeight: FontWeight.bold,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 4),
          Text(
            'الأستاذ أشرف سليم — خبير تدريس اللغة العربية',
            style: GoogleFonts.cairo(
              color: FushaColors.khaki,
              fontSize: 11,
            ),
          ),
        ],
      ),
    );
  }

  // ── Authenticated widgets ──

  Widget _buildStatsGrid(ThemeData theme) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
      child: FutureBuilder<Map<String, dynamic>>(
        future: _statsFuture,
        builder: (context, snapshot) {
          final bool isLoading = snapshot.connectionState == ConnectionState.waiting;
          final int quizzesCount = snapshot.data?['quizzes_count'] ?? 0;
          final int questionsCount = snapshot.data?['questions_count'] ?? 0;

          return BlocBuilder<CourseBloc, CourseState>(
            builder: (context, courseState) {
              int enrolledCoursesCount = 0;
              if (courseState is CoursesLoaded) {
                enrolledCoursesCount = courseState.myCourses.length;
              }

              return Row(
                children: [
                  Expanded(
                    child: _buildStatCard(
                      title: 'كورساتي',
                      value: courseState is CoursesLoading ? '...' : enrolledCoursesCount.toString(),
                      icon: Icons.menu_book_rounded,
                      color: AppTheme.primary,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _buildStatCard(
                      title: 'اختباراتي',
                      value: isLoading ? '...' : quizzesCount.toString(),
                      icon: Icons.emoji_events_rounded,
                      color: AppTheme.secondary,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _buildStatCard(
                      title: 'أسئلتي',
                      value: isLoading ? '...' : questionsCount.toString(),
                      icon: Icons.question_answer_rounded,
                      color: AppTheme.accent,
                    ),
                  ),
                ],
              );
            },
          );
        },
      ),
    );
  }

  Widget _buildStatCard({
    required String title,
    required String value,
    required IconData icon,
    required Color color,
  }) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 8),
      decoration: BoxDecoration(
        color: isDark ? AppTheme.surfaceCard : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isDark ? Colors.white.withOpacity(0.05) : const Color(0xFFE2E8F0),
        ),
        boxShadow: isDark
            ? []
            : [
                BoxShadow(
                  color: Colors.black.withOpacity(0.02),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(color: color.withOpacity(0.1), shape: BoxShape.circle),
            child: Icon(icon, color: color, size: 20),
          ),
          const SizedBox(height: 10),
          Text(
            value,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: theme.colorScheme.onSurface,
              fontFamily: 'Cairo',
            ),
          ),
          const SizedBox(height: 2),
          Text(
            title,
            style: TextStyle(
              fontSize: 11,
              color: theme.colorScheme.onSurface.withOpacity(0.5),
              fontFamily: 'Cairo',
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _buildShortcutCard({
    required String title,
    required IconData icon,
    required Color color,
    required String route,
  }) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return InkWell(
      onTap: () => context.go(route),
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
        decoration: BoxDecoration(
          color: isDark ? AppTheme.surfaceCard : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isDark ? Colors.white.withOpacity(0.05) : const Color(0xFFF1F5F9),
          ),
          boxShadow: isDark
              ? []
              : [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.02),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(color: color.withOpacity(0.1), shape: BoxShape.circle),
              child: Icon(icon, color: color, size: 20),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                title,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: theme.colorScheme.onSurface,
                  fontFamily: 'Cairo',
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMyCoursesSection(ThemeData theme) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 12.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'دوراتي المشترك بها',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: theme.colorScheme.onSurface,
                  fontFamily: 'Cairo',
                ),
              ),
              TextButton(
                onPressed: () => context.go('/my-courses'),
                child: const Text(
                  'عرض الكل',
                  style: TextStyle(fontFamily: 'Cairo', color: AppTheme.primary, fontSize: 12),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          BlocBuilder<CourseBloc, CourseState>(
            builder: (context, state) {
              if (state is CoursesLoading) {
                return const SizedBox(height: 120, child: Center(child: CircularProgressIndicator(color: AppTheme.primary)));
              }
              if (state is CoursesLoaded) {
                final myCourses = state.myCourses;
                if (myCourses.isEmpty) {
                  return Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 28, horizontal: 20),
                    decoration: BoxDecoration(
                      color: theme.cardTheme.color?.withOpacity(0.5) ?? theme.colorScheme.surface.withOpacity(0.5),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: theme.colorScheme.onSurface.withOpacity(0.05)),
                    ),
                    child: Column(
                      children: [
                        Icon(Icons.class_outlined, size: 48, color: theme.colorScheme.onSurface.withOpacity(0.3)),
                        const SizedBox(height: 12),
                        Text(
                          'لم تشترك في أي كورس بعد',
                          style: TextStyle(
                            color: theme.colorScheme.onSurface.withOpacity(0.7),
                            fontWeight: FontWeight.bold,
                            fontFamily: 'Cairo',
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'ادخل كود تفعيل أو تصفح الكورسات المتاحة',
                          style: TextStyle(
                            color: theme.colorScheme.onSurface.withOpacity(0.38),
                            fontSize: 12,
                            fontFamily: 'Cairo',
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  );
                }
                return SizedBox(
                  height: 120,
                  child: ListView.builder(
                    scrollDirection: Axis.horizontal,
                    itemCount: myCourses.length,
                    itemBuilder: (context, index) {
                      final course = myCourses[index];
                      return _buildHorizontalCourseCard(theme, course);
                    },
                  ),
                );
              }
              return const SizedBox();
            },
          ),
        ],
      ),
    );
  }

  Widget _buildHorizontalCourseCard(ThemeData theme, Map<String, dynamic> course) {
    return GestureDetector(
      onTap: () => context.go('/course/${course['id']}'),
      child: Container(
        width: 220,
        margin: const EdgeInsets.only(left: 12),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: theme.cardTheme.color ?? theme.colorScheme.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppTheme.primary.withOpacity(0.15)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppTheme.primary.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: const Text(
                    'مفعّل',
                    style: TextStyle(
                      color: AppTheme.primary,
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      fontFamily: 'Cairo',
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Expanded(
              child: Text(
                course['title'] ?? 'كورس',
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 13,
                  color: theme.colorScheme.onSurface,
                  fontFamily: 'Cairo',
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            Row(
              children: [
                Icon(Icons.menu_book, size: 13, color: theme.colorScheme.onSurface.withOpacity(0.4)),
                const SizedBox(width: 4),
                Text(
                  '${course['lessons_count'] ?? course['total_lessons'] ?? 0} درس',
                  style: TextStyle(
                    color: theme.colorScheme.onSurface.withOpacity(0.5),
                    fontSize: 11,
                    fontFamily: 'Cairo',
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSuggestedSection(ThemeData theme) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 12.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'الدورات المقترحة',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: theme.colorScheme.onSurface,
              fontFamily: 'Cairo',
            ),
          ),
          const SizedBox(height: 12),
          BlocBuilder<CourseBloc, CourseState>(
            builder: (context, state) {
              if (state is CoursesLoading) return const ShimmerVerticalList();
              if (state is CoursesLoaded) {
                final enrolledIds = state.myCourses.map((c) => c['id']).toSet();
                final suggestedCourses =
                    state.allCourses.where((c) => !enrolledIds.contains(c['id'])).toList();

                if (suggestedCourses.isEmpty) {
                  return const EmptyState(
                    icon: Icons.school_outlined,
                    title: 'لا توجد مقترحات جديدة حالياً',
                    description: 'سوف تظهر هنا المقترحات الموصى بها لك قريباً',
                  );
                }
                return ListView.builder(
                  physics: const NeverScrollableScrollPhysics(),
                  shrinkWrap: true,
                  itemCount: suggestedCourses.length,
                  itemBuilder: (context, index) => CourseCard(
                    course: suggestedCourses[index],
                    isSubscribed: false,
                    onRefresh: _refresh,
                  ),
                );
              }
              return const SizedBox();
            },
          ),
        ],
      ),
    );
  }
}
