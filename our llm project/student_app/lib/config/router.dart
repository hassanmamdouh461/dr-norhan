import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../blocs/auth/auth_bloc.dart';
import '../blocs/auth/auth_state.dart';
import '../screens/login_screen.dart';
import '../screens/home_screen.dart';
import '../screens/course_details_screen.dart';
import '../screens/lesson_player_screen.dart';
import '../screens/pdf_viewer_screen.dart';
import '../screens/exam_screen.dart';
import '../screens/biometric_lock_screen.dart';

import '../widgets/fusha_palette_transition.dart';

// ── Custom Page Transitions (Fusha Random Palette Curtain Sweep) ──
typedef _CustomTransitionPage = FushaPaletteTransitionPage<Widget>;

// ── Route Names ──
class AppRoutes {
  static const String loading = '/loading';
  static const String login = '/login';
  static const String home = '/home';
  static const String courses = '/courses';
  static const String myCourses = '/my-courses';
  static const String exams = '/exams';
  static const String profile = '/profile';
  static const String questions = '/questions';
  static const String courseDetails = '/course/:id';
  static const String lessonPlayer = '/lesson/:id';
  static const String examDetails = '/exam/:id';
  static const String pdfViewer = '/pdf';
}

// ── GoRouter Configuration ──
class AppRouter {
  static bool useBiometrics = false;
  static bool biometricUnlocked = false;

  static GoRouter createRouter(AuthBloc authBloc, {String? initialLink}) {
    return GoRouter(
      initialLocation: initialLink ?? AppRoutes.loading,
      refreshListenable: GoRouterRefreshStream(authBloc.stream),
      redirect: (context, state) {
        final authState = authBloc.state;
        final location = state.matchedLocation;
        final isAuthRoute = location == AppRoutes.login;
        final isLoadingRoute = location == AppRoutes.loading;
        final isLockRoute = location == '/lock';

        // Gate access via biometric lock screen if enabled and not unlocked
        if (authState is AuthAuthenticated && useBiometrics && !biometricUnlocked) {
          if (!isLockRoute) {
            return '/lock';
          }
          return null; // Stay on lock screen
        }

        // If unlocked and trying to access lock screen, redirect to home
        if (isLockRoute) {
          if (authState is AuthAuthenticated) {
            if (!useBiometrics || biometricUnlocked) {
              return AppRoutes.home;
            }
          } else {
            return AppRoutes.login;
          }
        }

        // Redirect from loading based on auth state
        if (isLoadingRoute) {
          if (authState is AuthChecking || authState is AuthInitial) {
            return null; // Stay on loading while checking
          }
          if (authState is AuthAuthenticated) {
            return AppRoutes.home;
          }
          return AppRoutes.login;
        }

        // Don't redirect while checking auth on other routes
        if (authState is AuthChecking || authState is AuthInitial) {
          return null;
        }

        // Profile completion required: keep the user on the login screen
        if (authState is AuthNeedsProfileSetup && !isAuthRoute) {
          return AppRoutes.login;
        }

        // No Guest Mode: Unauthenticated students must log in
        if (authState is AuthUnauthenticated || authState is AuthFailure) {
          return isAuthRoute ? null : AppRoutes.login;
        }

        // Authenticated user trying to access login: redirect to home
        if (authState is AuthAuthenticated && isAuthRoute) {
          return AppRoutes.home;
        }

        return null;
      },
      routes: [
        // Loading Route (Fusha Luxury Splash)
        GoRoute(
          path: AppRoutes.loading,
          name: 'loading',
          pageBuilder: (context, state) => _CustomTransitionPage(
            key: state.pageKey,
            child: const FushaSplashScreen(),
          ),
        ),

        // Lock Route
        GoRoute(
          path: '/lock',
          name: 'lock',
          pageBuilder: (context, state) => NoTransitionPage(
            key: state.pageKey,
            child: BiometricLockScreen(
              onUnlocked: () {
                AppRouter.biometricUnlocked = true;
                context.go(AppRoutes.home);
              },
            ),
          ),
        ),

        // Login Route
        GoRoute(
          path: AppRoutes.login,
          name: 'login',
          pageBuilder: (context, state) => _CustomTransitionPage(
            key: state.pageKey,
            child: const LoginScreen(),
          ),
        ),

        // Main App Routes with Shell
        ShellRoute(
          builder: (context, state, child) => _MainShell(child: child),
          routes: [
            // Home Tab
            GoRoute(
              path: AppRoutes.home,
              name: 'home',
              pageBuilder: (context, state) => NoTransitionPage(
                key: state.pageKey,
                child: const HomeScreen(initialTab: 0),
              ),
            ),

            // Courses (Explore) Tab
            GoRoute(
              path: AppRoutes.courses,
              name: 'courses',
              pageBuilder: (context, state) => NoTransitionPage(
                key: state.pageKey,
                child: const HomeScreen(initialTab: 1),
              ),
            ),

            // My Courses (courses tab filtered to enrolled)
            GoRoute(
              path: AppRoutes.myCourses,
              name: 'my-courses',
              pageBuilder: (context, state) => NoTransitionPage(
                key: state.pageKey,
                child: const HomeScreen(initialTab: 1, myCoursesOnly: true),
              ),
            ),

            // Exams Tab
            GoRoute(
              path: AppRoutes.exams,
              name: 'exams',
              pageBuilder: (context, state) => NoTransitionPage(
                key: state.pageKey,
                child: const HomeScreen(initialTab: 2),
              ),
            ),

            // Questions Tab
            GoRoute(
              path: AppRoutes.questions,
              name: 'questions',
              pageBuilder: (context, state) => NoTransitionPage(
                key: state.pageKey,
                child: const HomeScreen(initialTab: 3),
              ),
            ),

            // Profile Tab
            GoRoute(
              path: AppRoutes.profile,
              name: 'profile',
              pageBuilder: (context, state) => NoTransitionPage(
                key: state.pageKey,
                child: const HomeScreen(initialTab: 4),
              ),
            ),

            // Course Details
            GoRoute(
              path: AppRoutes.courseDetails,
              name: 'course-details',
              pageBuilder: (context, state) {
                final courseId = state.pathParameters['id'];
                if (courseId == null) {
                  return _CustomTransitionPage(
                    key: state.pageKey,
                    child: _buildErrorScreen(context, 'معرف الكورس مفقود'),
                  );
                }
                return _CustomTransitionPage(
                  key: state.pageKey,
                  child: CourseDetailsScreen(courseId: courseId),
                );
              },
            ),

            // Lesson Player
            GoRoute(
              path: AppRoutes.lessonPlayer,
              name: 'lesson-player',
              pageBuilder: (context, state) {
                final lessonId = state.pathParameters['id'];
                if (lessonId == null) {
                  return _CustomTransitionPage(
                    key: state.pageKey,
                    child: _buildErrorScreen(context, 'معرف الدرس مفقود'),
                  );
                }
                final lessonTitle = (state.extra as String?) ?? state.uri.queryParameters['title'] ?? 'مشاهدة المحاضرة';
                return _CustomTransitionPage(
                  key: state.pageKey,
                  child: LessonPlayerScreen(lessonId: lessonId, lessonTitle: lessonTitle),
                );
              },
            ),

            // Exam Details / Taking
            GoRoute(
              path: AppRoutes.examDetails,
              name: 'exam-details',
              pageBuilder: (context, state) {
                final examId = state.pathParameters['id'];
                if (examId == null) {
                  return _CustomTransitionPage(
                    key: state.pageKey,
                    child: _buildErrorScreen(context, 'معرف الامتحان مفقود'),
                  );
                }
                final isPublic = state.uri.queryParameters['public'] == '1';
                return _CustomTransitionPage(
                  key: state.pageKey,
                  child: ExamScreen(examId: examId, isPublic: isPublic),
                );
              },
            ),

            // PDF Viewer
            GoRoute(
              path: AppRoutes.pdfViewer,
              name: 'pdf-viewer',
              pageBuilder: (context, state) {
                final url = state.uri.queryParameters['url'];
                if (url == null) {
                  return _CustomTransitionPage(
                    key: state.pageKey,
                    child: _buildErrorScreen(context, 'رابط الملف مفقود'),
                  );
                }
                final lessonId = state.uri.queryParameters['lessonId'] ?? state.uri.queryParameters['lesson_id'] ?? '';
                final title = state.uri.queryParameters['title'] ?? 'ملف PDF';
                return _CustomTransitionPage(
                  key: state.pageKey,
                  child: PdfViewerScreen(lessonId: lessonId, pdfTitle: title),
                );
              },
            ),
          ],
        ),
      ],
      errorBuilder: (context, state) => _buildErrorScreen(context, 'صفحة غير موجودة', details: state.uri.toString()),
    );
  }

  static Widget _buildErrorScreen(BuildContext context, String message, {String? details}) {
    return Scaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 64, color: Colors.red),
            const SizedBox(height: 16),
            Text(
              message,
              style: Theme.of(context).textTheme.headlineMedium,
            ),
            if (details != null) ...[
              const SizedBox(height: 8),
              Text(
                details,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () => context.go(AppRoutes.home),
              child: const Text('العودة للرئيسية'),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Main Shell with Bottom Navigation ──
class _MainShell extends StatefulWidget {
  final Widget child;

  const _MainShell({required this.child});

  @override
  State<_MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<_MainShell> {
  int _currentIndex = 0;

  final List<_TabItem> _tabs = [
    _TabItem(
      icon: Icons.home_outlined,
      activeIcon: Icons.home,
      label: 'الرئيسية',
      route: AppRoutes.home,
    ),
    _TabItem(
      icon: Icons.school_outlined,
      activeIcon: Icons.school,
      label: 'الكورسات',
      route: AppRoutes.courses,
    ),
    _TabItem(
      icon: Icons.assignment_outlined,
      activeIcon: Icons.assignment,
      label: 'الامتحانات',
      route: AppRoutes.exams,
    ),
    _TabItem(
      icon: Icons.question_answer_outlined,
      activeIcon: Icons.question_answer,
      label: 'الأسئلة',
      route: AppRoutes.questions,
    ),
    _TabItem(
      icon: Icons.person_outline,
      activeIcon: Icons.person,
      label: 'حسابي',
      route: AppRoutes.profile,
    ),
  ];

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Update current index based on route match
    final location = GoRouterState.of(context).matchedLocation;
    setState(() {
      // /my-courses lives inside the courses tab
      if (location == AppRoutes.myCourses) {
        _currentIndex = 1;
        return;
      }
      _currentIndex = _tabs.indexWhere((tab) =>
        location == tab.route || location.startsWith('${tab.route}/')
      );
      // Default to home if no match
      if (_currentIndex == -1) _currentIndex = 0;
    });
  }

  void _onTap(int index) {
    setState(() {
      _currentIndex = index;
    });
    context.go(_tabs[index].route);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: widget.child,
      bottomNavigationBar: AnimatedContainer(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
        child: NavigationBar(
          selectedIndex: _currentIndex,
          onDestinationSelected: _onTap,
          animationDuration: const Duration(milliseconds: 300),
          destinations: _tabs
              .asMap()
              .map((index, tab) => MapEntry(
                    index,
                    NavigationDestination(
                      icon: AnimatedSwitcher(
                        duration: const Duration(milliseconds: 200),
                        transitionBuilder: (child, animation) {
                          return ScaleTransition(
                            scale: animation,
                            child: child,
                          );
                        },
                        child: Icon(
                          _currentIndex == index ? tab.activeIcon : tab.icon,
                          key: ValueKey<bool>(_currentIndex == index),
                        ),
                      ),
                      label: tab.label,
                    ),
                  ))
              .values
              .toList(),
        ),
      ),
    );
  }
}

class _TabItem {
  final IconData icon;
  final IconData activeIcon;
  final String label;
  final String route;

  _TabItem({
    required this.icon,
    required this.activeIcon,
    required this.label,
    required this.route,
  });
}

class GoRouterRefreshStream extends ChangeNotifier {
  late final StreamSubscription<dynamic> _subscription;

  GoRouterRefreshStream(Stream<dynamic> stream) {
    notifyListeners();
    _subscription = stream.asBroadcastStream().listen(
          (dynamic _) => notifyListeners(),
        );
  }

  @override
  void dispose() {
    _subscription.cancel();
    super.dispose();
  }
}

class FushaSplashScreen extends StatefulWidget {
  const FushaSplashScreen({super.key});

  @override
  State<FushaSplashScreen> createState() => _FushaSplashScreenState();
}

class _FushaSplashScreenState extends State<FushaSplashScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _animController;
  late Animation<double> _fadeAnimation;
  late Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..forward();
    _fadeAnimation = CurvedAnimation(
      parent: _animController,
      curve: Curves.easeIn,
    );
    _scaleAnimation = Tween<double>(begin: 0.88, end: 1.0).animate(
      CurvedAnimation(parent: _animController, curve: Curves.easeOutBack),
    );
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0D1D18),
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              Color(0xFF0D1D18),
              Color(0xFF142B24),
              Color(0xFF163134),
            ],
          ),
        ),
        child: Center(
          child: FadeTransition(
            opacity: _fadeAnimation,
            child: ScaleTransition(
              scale: _scaleAnimation,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // Logo container with subtle gold aura
                  Container(
                    width: 124,
                    height: 124,
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.04),
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: const Color(0xFFE8B54A).withValues(alpha: 0.28),
                        width: 1.5,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFFE8B54A).withValues(alpha: 0.14),
                          blurRadius: 32,
                          spreadRadius: 4,
                        ),
                      ],
                    ),
                    child: Image.asset(
                      'assets/images/logo.png',
                      fit: BoxFit.contain,
                      errorBuilder: (_, __, ___) => const Icon(
                        Icons.auto_stories,
                        color: Color(0xFFE8B54A),
                        size: 54,
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                  const Text(
                    'فُصْحَى',
                    style: TextStyle(
                      fontFamily: 'Cairo',
                      fontSize: 32,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                      letterSpacing: 1.2,
                    ),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'منصة اللغة العربية — الأستاذ أشرف سليم',
                    style: TextStyle(
                      fontFamily: 'Cairo',
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                      color: Color(0xFFB7B19B),
                    ),
                  ),
                  const SizedBox(height: 44),
                  const SizedBox(
                    width: 38,
                    height: 38,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.8,
                      valueColor:
                          AlwaysStoppedAnimation<Color>(Color(0xFFE8B54A)),
                      backgroundColor: Color(0x33E8B54A),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
