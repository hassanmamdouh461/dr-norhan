import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../blocs/auth/auth_bloc.dart';
import '../blocs/auth/auth_event.dart';
import '../blocs/auth/auth_state.dart';
import '../blocs/course/course_bloc.dart';
import '../blocs/course/course_event.dart';
import '../config/theme.dart';
import '../config/router.dart';
import 'home_tabs/home_tab.dart';
import 'home_tabs/courses_tab.dart';
import 'home_tabs/exams_tab.dart';
import 'home_tabs/questions_tab.dart';
import 'home_tabs/profile_tab.dart';
import 'home_tabs/info_pages.dart';

/// Dashboard shell: hosts the 5 tabs (home / courses / exams / questions /
/// profile) and the navigation drawer. Guests get the same shell with
/// guest-aware tab content (web guest-mode parity).
class HomeScreen extends StatefulWidget {
  final int initialTab;
  final bool myCoursesOnly;

  const HomeScreen({super.key, this.initialTab = 0, this.myCoursesOnly = false});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  @override
  void initState() {
    super.initState();
    // Load the course catalogue once on entry (works for guests too)
    final authState = context.read<AuthBloc>().state;
    String? grade;
    if (authState is AuthAuthenticated) {
      grade = authState.profile['grade'];
    }
    context.read<CourseBloc>().add(FetchCoursesRequested(grade: grade));
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<AuthBloc, AuthState>(
      builder: (context, authState) {
        if (authState is AuthChecking || authState is AuthInitial || authState is AuthLoading) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator(color: AppTheme.primary)),
          );
        }

        final Map<String, dynamic>? profile =
            authState is AuthAuthenticated ? authState.profile : null;

        Widget content;
        switch (widget.initialTab) {
          case 0:
            content = HomeTab(profile: profile);
            break;
          case 1:
            content = CoursesTab(profile: profile, myCoursesOnly: widget.myCoursesOnly);
            break;
          case 2:
            content = ExamsTab(profile: profile);
            break;
          case 3:
            content = QuestionsTab(profile: profile);
            break;
          case 4:
            content = ProfileTab(profile: profile);
            break;
          default:
            content = HomeTab(profile: profile);
        }

        return Directionality(
          textDirection: TextDirection.rtl,
          child: Scaffold(
            drawer: _buildDrawer(context, profile),
            body: SafeArea(child: content),
          ),
        );
      },
    );
  }

  Widget _buildDrawer(BuildContext context, Map<String, dynamic>? profile) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final bool isGuest = profile == null;

    return Drawer(
      backgroundColor: theme.scaffoldBackgroundColor,
      child: Column(
        children: [
          UserAccountsDrawerHeader(
            decoration: BoxDecoration(
              color: isDark ? AppTheme.surfaceCard : theme.colorScheme.primary.withOpacity(0.04),
              border: Border(
                bottom: BorderSide(color: isDark ? Colors.white10 : Colors.black12),
              ),
            ),
            currentAccountPicture: ClipOval(
              child: Container(
                color: isDark ? Colors.white.withOpacity(0.04) : Colors.black.withOpacity(0.02),
                child: Image.asset(
                  'assets/images/logo.png',
                  fit: BoxFit.contain,
                  errorBuilder: (_, __, ___) => const Icon(Icons.school, color: AppTheme.primary, size: 36),
                ),
              ),
            ),
            accountName: Text(
              profile?['full_name'] ?? 'طالب فُصْحَى',
              style: TextStyle(
                fontFamily: 'Cairo',
                fontWeight: FontWeight.bold,
                color: isDark ? Colors.white : Colors.black87,
                fontSize: 15,
              ),
            ),
            accountEmail: Text(
              profile?['phone'] ?? profile?['email'] ?? 'منصة فُصْحَى التعليمية',
              style: TextStyle(
                fontFamily: 'Cairo',
                color: isDark ? Colors.white54 : Colors.black54,
                fontSize: 12,
              ),
            ),
          ),
          Expanded(
            child: ListView(
              padding: EdgeInsets.zero,
              children: [
                _buildDrawerItem(
                  icon: Icons.home_outlined,
                  label: 'الصفحة الرئيسية',
                  route: AppRoutes.home,
                ),
                _buildDrawerItem(
                  icon: Icons.school_outlined,
                  label: 'الدورات التعليمية',
                  route: AppRoutes.courses,
                ),
                _buildDrawerItem(
                  icon: Icons.menu_book_outlined,
                  label: 'كورساتي',
                  route: AppRoutes.myCourses,
                ),
                _buildDrawerItem(
                  icon: Icons.assignment_outlined,
                  label: 'الامتحانات',
                  route: AppRoutes.exams,
                ),
                _buildDrawerItem(
                  icon: Icons.question_answer_outlined,
                  label: 'بنك الأسئلة',
                  route: AppRoutes.questions,
                ),
                _buildDrawerItem(
                  icon: Icons.person_outline,
                  label: 'حسابي الشخصي',
                  route: AppRoutes.profile,
                ),
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 16),
                  child: Divider(height: 16),
                ),
                _buildInfoItem(icon: Icons.info_outline, label: 'عن المنصة', type: InfoPageType.about),
                _buildInfoItem(icon: Icons.policy_outlined, label: 'سياسة الخصوصية', type: InfoPageType.privacy),
                _buildInfoItem(icon: Icons.link_outlined, label: 'روابطنا الرسمية', type: InfoPageType.links),
                _buildInfoItem(icon: Icons.help_outline_outlined, label: 'المساعدة', type: InfoPageType.help),
              ],
            ),
          ),
          const Divider(height: 1),
          ListTile(
            leading: const Icon(Icons.logout_outlined, color: Colors.redAccent),
            title: const Text(
              'تسجيل الخروج',
              style: TextStyle(
                fontFamily: 'Cairo',
                color: Colors.redAccent,
                fontWeight: FontWeight.bold,
                fontSize: 13,
              ),
            ),
            onTap: () {
              Navigator.pop(context);
              _showLogoutConfirmationDialog(context);
            },
          ),
          const SizedBox(height: 12),
        ],
      ),
    );
  }

  Widget _buildDrawerItem({
    required IconData icon,
    required String label,
    required String route,
    required bool selected,
    bool requiresAuth = false,
    bool isGuest = false,
  }) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final bool locked = requiresAuth && isGuest;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12.0, vertical: 2.0),
      child: ListTile(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        leading: Icon(
          icon,
          color: selected ? AppTheme.primary : (isDark ? Colors.white38 : Colors.black38),
        ),
        title: Text(
          label,
          style: TextStyle(
            fontFamily: 'Cairo',
            fontWeight: selected ? FontWeight.bold : FontWeight.normal,
            color: selected ? AppTheme.primary : (isDark ? Colors.white70 : Colors.black87),
            fontSize: 13,
          ),
        ),
        trailing: locked
            ? Icon(Icons.lock_outline, size: 14, color: theme.colorScheme.onSurface.withOpacity(0.3))
            : null,
        selected: selected,
        selectedTileColor: AppTheme.primary.withOpacity(0.08),
        dense: true,
        onTap: () {
          Navigator.pop(context); // Close drawer
          // Locked items route to login via the router redirect
          context.go(locked ? AppRoutes.login : route);
        },
      ),
    );
  }

  Widget _buildInfoItem({
    required IconData icon,
    required String label,
    required InfoPageType type,
  }) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12.0, vertical: 2.0),
      child: ListTile(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        leading: Icon(icon, color: isDark ? Colors.white38 : Colors.black38),
        title: Text(
          label,
          style: TextStyle(
            fontFamily: 'Cairo',
            color: isDark ? Colors.white70 : Colors.black87,
            fontSize: 13,
          ),
        ),
        dense: true,
        onTap: () {
          Navigator.pop(context); // Close drawer
          Navigator.of(context, rootNavigator: true).push(
            MaterialPageRoute(builder: (_) => InfoPage(type: type)),
          );
        },
      ),
    );
  }

  void _showLogoutConfirmationDialog(BuildContext context) {
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
