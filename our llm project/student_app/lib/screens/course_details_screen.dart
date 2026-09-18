import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:shimmer/shimmer.dart';

import '../blocs/auth/auth_bloc.dart';
import '../blocs/auth/auth_state.dart';
import '../blocs/course/course_bloc.dart';
import '../blocs/course/course_event.dart';
import '../blocs/course/course_state.dart';
import '../config/theme.dart';
import '../widgets/app_loading_indicator.dart';
import 'lesson_player_screen.dart';
import 'pdf_viewer_screen.dart';

class CourseDetailsScreen extends StatefulWidget {
  final String courseId;

  const CourseDetailsScreen({super.key, required this.courseId});

  @override
  State<CourseDetailsScreen> createState() => _CourseDetailsScreenState();
}

class _CourseDetailsScreenState extends State<CourseDetailsScreen> {
  DialogRoute<void>? _loadingDialogRoute;

  void _showLoadingDialog() {
    if (_loadingDialogRoute?.isActive ?? false) return;

    final navigator = Navigator.of(context, rootNavigator: true);
    final route = DialogRoute<void>(
      context: context,
      barrierDismissible: false,
      builder: (_) => const PopScope(
        canPop: false,
        child: Center(
          child: Card(
            child: Padding(
              padding: EdgeInsets.all(20.0),
              child: AppLoadingIndicator(),
            ),
          ),
        ),
      ),
    );
    _loadingDialogRoute = route;
    navigator.push<void>(route).then((_) {
      if (identical(_loadingDialogRoute, route)) {
        _loadingDialogRoute = null;
      }
    });
  }

  void _dismissLoadingDialog() {
    final route = _loadingDialogRoute;
    _loadingDialogRoute = null;
    final navigator = route?.navigator;
    if (route != null && navigator != null && navigator.mounted && route.isActive) {
      navigator.removeRoute(route);
    }
  }

  @override
  void dispose() {
    final route = _loadingDialogRoute;
    _loadingDialogRoute = null;
    if (route != null) {
      // Disposal can run while a navigator is locked or building its overlay.
      WidgetsBinding.instance.addPostFrameCallback((_) {
        final navigator = route.navigator;
        if (navigator != null && navigator.mounted && route.isActive) {
          navigator.removeRoute(route);
        }
      });
    }
    super.dispose();
  }

  @override
  void initState() {
    super.initState();
    context.read<CourseBloc>().add(FetchCourseDetailsRequested(courseId: widget.courseId));
  }

  @override
  Widget build(BuildContext context) {
    return BlocListener<CourseBloc, CourseState>(
      listener: (context, state) {
        if (state is CodeRedeemLoading) {
          _showLoadingDialog();
        } else if (state is CodeRedeemSuccess) {
          _dismissLoadingDialog();
          _showSuccessDialog(state.message);
          // Refresh course details
          context.read<CourseBloc>().add(FetchCourseDetailsRequested(courseId: widget.courseId));
        } else if (state is CodeRedeemFailure) {
          _dismissLoadingDialog();
          _showErrorDialog(state.message);
        }
      },
      child: BlocBuilder<CourseBloc, CourseState>(
        buildWhen: (previous, state) =>
            state is CourseDetailsLoading ||
            state is CourseDetailsLoaded ||
            state is CourseFailure,
        builder: (context, state) {
          if (state is CourseDetailsLoading) {
            return Scaffold(
              body: _buildLoader(),
            );
          }

          if (state is CourseDetailsLoaded) {
            final course = state.course;
            final units = state.units;
            final progress = state.progress;
            final bool isSubscribed = progress['is_subscribed'] ?? false;
            final bool isFree = course['is_free'] == 1 || course['is_free'] == true;
            final bool hasAccess = isSubscribed || isFree;
            final String coverUrl = course['cover_image'] ?? '';

            return Scaffold(
              bottomNavigationBar: !hasAccess
                  ? _buildActivationBottomBar(course)
                  : null,
              body: CustomScrollView(
                slivers: [
                  // Glassmorphic App Bar with Course Cover Image
                  SliverAppBar(
                    expandedHeight: 220.0,
                    floating: false,
                    pinned: true,
                    backgroundColor: Theme.of(context).scaffoldBackgroundColor,
                    flexibleSpace: FlexibleSpaceBar(
                      background: Stack(
                        fit: StackFit.expand,
                        children: [
                          coverUrl.isNotEmpty
                              ? CachedNetworkImage(
                                  imageUrl: coverUrl,
                                  fit: BoxFit.cover,
                                  placeholder: (ctx, url) => Container(color: Colors.white.withOpacity(0.05)),
                                  errorWidget: (ctx, url, err) => Container(color: Colors.indigo.shade900),
                                )
                              : Container(color: Colors.indigo.shade900),
                          Container(
                            decoration: const BoxDecoration(
                              gradient: LinearGradient(
                                colors: [Colors.transparent, Colors.black87],
                                begin: Alignment.topCenter,
                                end: Alignment.bottomCenter,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    leading: IconButton(
                      icon: Icon(
                        Icons.arrow_back,
                        color: Theme.of(context).brightness == Brightness.dark
                            ? Colors.white
                            : Colors.black87,
                      ),
                      onPressed: () => Navigator.of(context).pop(),
                    ),
                  ),

                  // Course Intro Metadata
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.all(20.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            course['title'] ?? 'تفاصيل الكورس',
                            style: TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.bold,
                              color: Theme.of(context).colorScheme.onSurface,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                decoration: BoxDecoration(
                                  color: isFree
                                      ? Colors.teal.withOpacity(0.15)
                                      : (hasAccess ? Colors.green.withOpacity(0.15) : Colors.orange.withOpacity(0.15)),
                                  borderRadius: BorderRadius.circular(6),
                                  border: Border.all(
                                    color: isFree ? Colors.teal : (hasAccess ? Colors.green : Colors.orange),
                                    width: 0.5,
                                  ),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    if (isFree) ...[
                                      Icon(Icons.card_giftcard_rounded, size: 13,
                                        color: Theme.of(context).brightness == Brightness.dark ? Colors.tealAccent : Colors.teal.shade700),
                                      const SizedBox(width: 4),
                                    ],
                                    Text(
                                      isFree
                                          ? 'مجاني - مفتوح للجميع'
                                          : (hasAccess ? 'مفعّل بالكامل' : 'يحتاج تفعيل كود'),
                                      style: TextStyle(
                                        color: isFree
                                            ? (Theme.of(context).brightness == Brightness.dark ? Colors.tealAccent : Colors.teal.shade700)
                                            : (hasAccess
                                                ? (Theme.of(context).brightness == Brightness.dark ? Colors.greenAccent : Colors.green.shade700)
                                                : (Theme.of(context).brightness == Brightness.dark ? Colors.orangeAccent : Colors.orange.shade700)),
                                        fontSize: 11,
                                        fontWeight: FontWeight.bold,
                                        fontFamily: 'Cairo',
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(width: 12),
                              Icon(
                                Icons.menu_book_outlined,
                                size: 16,
                                color: Theme.of(context).colorScheme.onSurface.withOpacity(0.5),
                              ),
                              const SizedBox(width: 4),
                              Text(
                                '${units.length} وحدات دراسية',
                                style: TextStyle(
                                  color: Theme.of(context).colorScheme.onSurface.withOpacity(0.6),
                                  fontSize: 12,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          Text(
                            course['description'] ?? 'لا يوجد وصف متاح لهذا الكورس حالياً.',
                            style: TextStyle(
                              color: Theme.of(context).colorScheme.onSurface.withOpacity(0.8),
                              fontSize: 13,
                              height: 1.5,
                            ),
                          ),
                          if (hasAccess) ...[
                            const SizedBox(height: 16),
                            _buildCourseProgressTracker(progress, units),
                          ],
                          Divider(
                            color: Theme.of(context).dividerColor.withOpacity(0.1),
                            height: 32,
                          ),
                        ],
                      ),
                    ),
                  ),

                  // Units & Lessons List
                  SliverList(
                    delegate: SliverChildBuilderDelegate(
                      (context, index) {
                        final unit = units[index];
                        final lessons = unit['lessons'] as List<dynamic>? ?? [];

                        return Theme(
                          data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
                          child: ExpansionTile(
                            iconColor: AppTheme.primary,
                            collapsedIconColor: Theme.of(context).colorScheme.onSurface.withOpacity(0.6),
                            title: Text(
                              unit['name'] ?? unit['title'] ?? 'الوحدة الدراسية',
                              style: TextStyle(
                                color: Theme.of(context).colorScheme.onSurface,
                                fontSize: 15,
                                fontWeight: FontWeight.bold,
                                fontFamily: 'Cairo',
                              ),
                            ),
                            subtitle: Text(
                              '${lessons.length} محاضرات',
                              style: TextStyle(
                                color: Theme.of(context).colorScheme.onSurface.withOpacity(0.5),
                                fontSize: 11,
                                fontFamily: 'Cairo',
                              ),
                            ),
                            children: lessons.map((lesson) {
                              final bool isLessonFreePreview = lesson['is_free_preview'] == 1 || lesson['is_free_preview'] == true;
                              final bool canAccess = hasAccess || isLessonFreePreview;
                              return _buildLessonRow(lesson, canAccess);
                            }).toList(),
                          ),
                        );
                      },
                      childCount: units.length,
                    ),
                  ),
                  const SliverToBoxAdapter(child: SizedBox(height: 40)),
                ],
              ),
            );
          }

          if (state is CourseFailure) {
            return Scaffold(
              body: Center(
                child: Padding(
                  padding: const EdgeInsets.all(24.0),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.error_outline, size: 48, color: Colors.redAccent),
                      const SizedBox(height: 12),
                      Text(
                        state.message,
                        textAlign: TextAlign.center,
                        style: TextStyle(color: Theme.of(context).colorScheme.onSurface.withOpacity(0.7)),
                      ),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: () {
                          context.read<CourseBloc>().add(FetchCourseDetailsRequested(courseId: widget.courseId));
                        },
                        child: const Text('إعادة المحاولة', style: TextStyle(fontFamily: 'Cairo')),
                      ),
                    ],
                  ),
                ),
              ),
            );
          }

          return const Scaffold(
            body: Center(
              child: AppLoadingIndicator(),
            ),
          );
        },
      ),
    );
  }

  Widget _buildLessonRow(Map<String, dynamic> lesson, bool canAccess) {
    final String lessonType = lesson['type'] ?? 'video';
    IconData iconData = Icons.play_circle_outline;
    if (lessonType == 'pdf') iconData = Icons.picture_as_pdf_outlined;

    final bool isFree = lesson['is_free_preview'] == 1 || lesson['is_free_preview'] == true;

    return InkWell(
      onTap: () {
        if (!canAccess) {
          final bool isGuest = context.read<AuthBloc>().state is! AuthAuthenticated;
          if (isGuest) {
            _showGuestLoginDialog();
          } else {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text(
                  'هذه المحاضرة مغلقة. يرجى تفعيل الكورس أولاً لمشاهدتها.',
                  style: TextStyle(fontFamily: 'Cairo'),
                ),
                backgroundColor: Colors.orangeAccent,
              ),
            );
          }
          return;
        }

        // Open Lesson content
        if (lessonType == 'pdf') {
          Navigator.of(context).push(MaterialPageRoute(
            builder: (_) => PdfViewerScreen(
              lessonId: lesson['id'],
              pdfTitle: lesson['title'] ?? 'مرفق PDF',
            ),
          ));
        } else {
          Navigator.of(context).push(MaterialPageRoute(
            builder: (_) => LessonPlayerScreen(
              lessonId: lesson['id'],
              lessonTitle: lesson['title'] ?? 'مشاهدة المحاضرة',
            ),
          ));
        }
      },
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 6),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Theme.of(context).brightness == Brightness.dark
              ? AppTheme.surface.withOpacity(0.4)
              : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: Theme.of(context).brightness == Brightness.dark
                ? Colors.white.withOpacity(0.03)
                : Colors.black.withOpacity(0.05),
          ),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: canAccess
                    ? AppTheme.primary.withOpacity(0.1)
                    : (Theme.of(context).brightness == Brightness.dark
                        ? Colors.white.withOpacity(0.04)
                        : Colors.black.withOpacity(0.04)),
                shape: BoxShape.circle,
              ),
              child: Icon(
                iconData,
                color: canAccess
                    ? AppTheme.primary
                    : (Theme.of(context).brightness == Brightness.dark
                        ? Colors.white38
                        : Colors.black38),
                size: 22,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    lesson['title'] ?? 'محاضرة',
                    style: TextStyle(
                      color: canAccess
                          ? Theme.of(context).colorScheme.onSurface
                          : (Theme.of(context).brightness == Brightness.dark
                              ? Colors.white38
                              : Colors.black38),
                      fontWeight: FontWeight.bold,
                      fontSize: 13,
                    ),
                  ),
                  if (lesson['description'] != null)
                    Text(
                      lesson['description'],
                      style: TextStyle(
                        color: Theme.of(context).brightness == Brightness.dark
                            ? Colors.white24
                            : Colors.black45,
                        fontSize: 10,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                ],
              ),
            ),
            const SizedBox(width: 8),

            // Badge / lock status
            if (isFree && !canAccess)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: Colors.teal.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  'مجاني',
                  style: TextStyle(
                    color: Theme.of(context).brightness == Brightness.dark
                        ? Colors.tealAccent
                        : Colors.teal.shade700,
                    fontSize: 9,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              )
            else if (!canAccess)
              Icon(
                Icons.lock_outline,
                color: Theme.of(context).brightness == Brightness.dark
                    ? Colors.white24
                    : Colors.black26,
                size: 18,
              )
            else if (lesson['is_completed'] == 1 || lesson['is_completed'] == true)
              Icon(
                Icons.check_circle,
                color: Theme.of(context).brightness == Brightness.dark
                    ? Colors.greenAccent
                    : Colors.green.shade600,
                size: 18,
              )
            else
              const Icon(
                Icons.play_arrow_outlined,
                color: AppTheme.primary,
                size: 20,
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildLoader() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final shimmerBase = isDark ? Colors.white10 : Colors.grey.shade300;
    final shimmerHighlight = isDark ? Colors.white24 : Colors.grey.shade100;

    return Shimmer.fromColors(
      baseColor: shimmerBase,
      highlightColor: shimmerHighlight,
      child: Column(
        children: [
          Container(height: 220, color: Colors.white),
          const SizedBox(height: 20),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(height: 24, width: 200, color: Colors.white),
                const SizedBox(height: 8),
                Container(height: 16, width: 120, color: Colors.white),
                const SizedBox(height: 20),
                Container(height: 80, width: double.infinity, color: Colors.white),
                const SizedBox(height: 32),
                Container(height: 50, width: double.infinity, color: Colors.white),
                const SizedBox(height: 12),
                Container(height: 50, width: double.infinity, color: Colors.white),
              ],
            ),
          )
        ],
      ),
    );
  }

  Map<String, dynamic>? _getNextLessonToStudy(List<dynamic> unitsList) {
    for (var unit in unitsList) {
      final lessons = unit['lessons'] as List?;
      if (lessons != null) {
        for (var lesson in lessons) {
          final isCompleted = lesson['is_completed'] == 1 || lesson['is_completed'] == true;
          if (!isCompleted) {
            return Map<String, dynamic>.from(lesson);
          }
        }
      }
    }
    if (unitsList.isNotEmpty) {
      final firstLessons = unitsList.first['lessons'] as List?;
      if (firstLessons != null && firstLessons.isNotEmpty) {
        return Map<String, dynamic>.from(firstLessons.first);
      }
    }
    return null;
  }

  Widget _buildCourseProgressTracker(Map<String, dynamic> progress, List<dynamic> unitsList) {
    final theme = Theme.of(context);
    final int completed = progress['completed'] ?? progress['completed_lessons'] ?? 0;
    final int total = progress['total_lessons'] ?? 0;
    final double percent = total > 0 ? (completed / total) : 0.0;
    final int percentageInt = (percent * 100).round();

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: theme.colorScheme.primary.withOpacity(0.05),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: theme.colorScheme.primary.withOpacity(0.15)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'تقدمك في الكورس',
                style: TextStyle(
                  fontFamily: 'Cairo',
                  fontWeight: FontWeight.bold,
                  fontSize: 13,
                  color: theme.colorScheme.onSurface,
                ),
              ),
              Text(
                '$percentageInt%',
                style: TextStyle(
                  fontFamily: 'Cairo',
                  fontWeight: FontWeight.bold,
                  fontSize: 13,
                  color: AppTheme.primary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: LinearProgressIndicator(
              value: percent,
              minHeight: 8,
              backgroundColor: theme.brightness == Brightness.dark 
                  ? Colors.white12 
                  : Colors.black.withOpacity(0.05),
              valueColor: const AlwaysStoppedAnimation<Color>(AppTheme.primary),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'أنجزت $completed من أصل $total محاضرة',
            style: TextStyle(
              fontFamily: 'Cairo',
              fontSize: 11,
              color: theme.colorScheme.onSurface.withOpacity(0.5),
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: () {
                final nextLesson = _getNextLessonToStudy(unitsList);
                if (nextLesson != null) {
                  Navigator.of(context).push(MaterialPageRoute(
                    builder: (_) => LessonPlayerScreen(
                      lessonId: nextLesson['id'],
                      lessonTitle: nextLesson['title'] ?? 'مشاهدة المحاضرة',
                    ),
                  )).then((_) {
                    if (mounted) {
                      context.read<CourseBloc>().add(FetchCourseDetailsRequested(courseId: widget.courseId));
                    }
                  });
                }
              },
              icon: const Icon(Icons.play_circle_fill_rounded, size: 18),
              label: const Text('أكمل التعلم', style: TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.bold, fontSize: 13)),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.primary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 8),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _showGuestLoginDialog() {
    showDialog(
      context: context,
      builder: (ctx) => Directionality(
        textDirection: TextDirection.rtl,
        child: AlertDialog(
          icon: const Icon(Icons.lock_outline, color: AppTheme.primary, size: 42),
          title: const Text(
            'محتوى للطلاب المسجلين',
            style: TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.bold, fontSize: 17),
          ),
          content: const Text(
            'هذه المحاضرة متاحة للطلاب المشتركين فقط. سجّل دخولك أو أنشئ حساباً لتفعيل الكورس ومشاهدة كل المحاضرات.',
            textAlign: TextAlign.center,
            style: TextStyle(fontFamily: 'Cairo', fontSize: 13),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('لاحقاً', style: TextStyle(fontFamily: 'Cairo', color: Colors.grey)),
            ),
            ElevatedButton(
              onPressed: () {
                Navigator.of(ctx).pop();
                context.go('/login');
              },
              style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primary),
              child: const Text(
                'تسجيل الدخول',
                style: TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.bold, color: Colors.white),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActivationBottomBar(Map<String, dynamic> course) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final bool isGuest = context.read<AuthBloc>().state is! AuthAuthenticated;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? AppTheme.surfaceCard : Colors.white,
        border: Border(
          top: BorderSide(
            color: isDark ? Colors.white.withOpacity(0.05) : const Color(0xFFF1F5F9),
            width: 1,
          ),
        ),
      ),
      child: SafeArea(
        child: Row(
          children: [
            Expanded(
              child: ElevatedButton(
                onPressed: () => isGuest ? context.go('/login') : _showRedeemBottomSheet(course),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.primary,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(isGuest ? Icons.login : Icons.vpn_key_outlined, color: Colors.white, size: 20),
                    const SizedBox(width: 8),
                    Text(
                      isGuest ? 'سجّل الدخول لتفعيل الكورس' : 'تفعيل الكورس بكود',
                      style: const TextStyle(
                        fontFamily: 'Cairo',
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                        color: Colors.white,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showRedeemBottomSheet(Map<String, dynamic> course) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final controller = TextEditingController();
    final formKey = GlobalKey<FormState>();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return Directionality(
          textDirection: TextDirection.rtl,
          child: Padding(
            padding: EdgeInsets.only(
              bottom: MediaQuery.of(ctx).viewInsets.bottom,
            ),
            child: Container(
              decoration: BoxDecoration(
                color: isDark ? AppTheme.surfaceCard : Colors.white,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
              ),
              padding: const EdgeInsets.fromLTRB(24, 20, 24, 24),
              child: Form(
                key: formKey,
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
                    const SizedBox(height: 20),
                    Text(
                      'تفعيل كورس: ${course['title'] ?? ''}',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: theme.colorScheme.onSurface,
                        fontFamily: 'Cairo',
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'يرجى إدخال كود التفعيل المكون من 12 رمزاً لتفعيل هذا الكورس بالكامل.',
                      style: TextStyle(
                        fontSize: 12,
                        color: theme.colorScheme.onSurface.withOpacity(0.5),
                        fontFamily: 'Cairo',
                      ),
                    ),
                    const SizedBox(height: 20),
                    TextFormField(
                      controller: controller,
                      autofocus: true,
                      style: TextStyle(
                        fontFamily: 'Cairo',
                        color: theme.colorScheme.onSurface,
                      ),
                      decoration: InputDecoration(
                        hintText: 'أدخل كود التفعيل هنا...',
                        hintStyle: TextStyle(
                          fontFamily: 'Cairo',
                          color: theme.colorScheme.onSurface.withOpacity(0.3),
                        ),
                        prefixIcon: const Icon(Icons.vpn_key, color: AppTheme.primary),
                        filled: true,
                        fillColor: isDark ? AppTheme.surface.withOpacity(0.4) : const Color(0xFFF8FAFC),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide(color: AppTheme.primary.withOpacity(0.15)),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide(color: AppTheme.primary.withOpacity(0.15)),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(color: AppTheme.primary, width: 2),
                        ),
                      ),
                      validator: (val) {
                        if (val == null || val.trim().isEmpty) {
                          return 'يرجى إدخال الكود أولاً';
                        }
                        if (val.trim().length < 4) {
                          return 'الكود غير صالح';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 24),
                    ElevatedButton(
                      onPressed: () {
                        if (formKey.currentState?.validate() ?? false) {
                          Navigator.of(ctx).pop(); // Close bottom sheet
                          context.read<CourseBloc>().add(
                                RedeemCodeRequested(code: controller.text.trim()),
                              );
                        }
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.primary,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: const Text(
                        'تأكيد التفعيل',
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
      },
    );
  }

  void _showSuccessDialog(String message) {
    showDialog(
      context: context,
      builder: (ctx) {
        return Directionality(
          textDirection: TextDirection.rtl,
          child: AlertDialog(
            icon: const Icon(Icons.check_circle_outline, color: Colors.green, size: 48),
            title: const Text(
              'تم التفعيل بنجاح',
              style: TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.bold),
            ),
            content: Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(fontFamily: 'Cairo'),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(ctx).pop(),
                child: const Text('حسنًا', style: TextStyle(fontFamily: 'Cairo', color: AppTheme.primary, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        );
      },
    );
  }

  void _showErrorDialog(String message) {
    showDialog(
      context: context,
      builder: (ctx) {
        return Directionality(
          textDirection: TextDirection.rtl,
          child: AlertDialog(
            icon: const Icon(Icons.error_outline, color: Colors.redAccent, size: 48),
            title: const Text(
              'خطأ في التفعيل',
              style: TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.bold),
            ),
            content: Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(fontFamily: 'Cairo'),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(ctx).pop(),
                child: const Text('حاول مرة أخرى', style: TextStyle(fontFamily: 'Cairo', color: AppTheme.primary, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        );
      },
    );
  }
}
