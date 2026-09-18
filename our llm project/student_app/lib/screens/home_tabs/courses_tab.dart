import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../blocs/course/course_bloc.dart';
import '../../blocs/course/course_event.dart';
import '../../blocs/course/course_state.dart';
import '../../config/theme.dart';
import '../../widgets/course_card.dart';
import '../../widgets/empty_state.dart';
import 'home_widgets.dart';

/// Courses tab: segmented view of all courses / enrolled courses + search.
class CoursesTab extends StatefulWidget {
  final Map<String, dynamic>? profile; // null => guest
  final bool myCoursesOnly;

  const CoursesTab({super.key, required this.profile, this.myCoursesOnly = false});

  @override
  State<CoursesTab> createState() => _CoursesTabState();
}

class _CoursesTabState extends State<CoursesTab> {
  final _searchController = TextEditingController();
  String _searchQuery = '';
  late int _segment; // 0 = all, 1 = mine

  bool get _isGuest => widget.profile == null;

  @override
  void initState() {
    super.initState();
    _segment = widget.myCoursesOnly ? 1 : 0;
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    context.read<CourseBloc>().add(FetchCoursesRequested(grade: widget.profile?['grade']));
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Column(
      children: [
        TabHeader(title: 'الدورات التعليمية', isGuest: _isGuest),

        // Segmented filter: all / my courses
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 4.0),
          child: Container(
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(
              color: isDark ? Colors.white.withOpacity(0.04) : Colors.black.withOpacity(0.04),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                _buildSegmentButton(theme, 'كل الكورسات', 0),
                _buildSegmentButton(theme, 'كورساتي', 1),
              ],
            ),
          ),
        ),

        // Search Bar
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 8.0),
          child: TextFormField(
            controller: _searchController,
            style: TextStyle(fontFamily: 'Cairo', color: theme.colorScheme.onSurface, fontSize: 14),
            decoration: InputDecoration(
              hintText: 'ابحث عن دورة',
              hintStyle: TextStyle(
                fontFamily: 'Cairo',
                color: theme.colorScheme.onSurface.withOpacity(0.4),
                fontSize: 13,
              ),
              prefixIcon: Icon(Icons.search, color: theme.colorScheme.onSurface.withOpacity(0.4)),
              filled: true,
              fillColor: isDark ? Colors.white.withOpacity(0.04) : Colors.black.withOpacity(0.04),
              contentPadding: const EdgeInsets.symmetric(vertical: 8),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(24),
                borderSide: BorderSide.none,
              ),
            ),
            onChanged: (val) {
              setState(() => _searchQuery = val.trim().toLowerCase());
            },
          ),
        ),

        Expanded(
          child: _segment == 1 && _isGuest
              ? const LoginPromptView(
                  title: 'كورساتك تظهر هنا بعد تسجيل الدخول',
                  description: 'سجّل دخولك لعرض الكورسات المشترك بها ومتابعة تقدمك الدراسي.',
                  icon: Icons.menu_book_outlined,
                )
              : RefreshIndicator(
                  onRefresh: _refresh,
                  color: AppTheme.primary,
                  child: BlocBuilder<CourseBloc, CourseState>(
                    builder: (context, state) {
                      if (state is CoursesLoading) {
                        return const SingleChildScrollView(
                          physics: AlwaysScrollableScrollPhysics(),
                          child: ShimmerVerticalList(),
                        );
                      }

                      if (state is CoursesLoaded) {
                        var courses = _segment == 1 ? state.myCourses : state.allCourses;

                        if (_searchQuery.isNotEmpty) {
                          courses = courses.where((c) {
                            final title = (c['title'] as String? ?? '').toLowerCase();
                            return title.contains(_searchQuery);
                          }).toList();
                        }

                        if (courses.isEmpty) {
                          return ListView(
                            physics: const AlwaysScrollableScrollPhysics(),
                            children: [
                              const SizedBox(height: 60),
                              if (_searchQuery.isNotEmpty)
                                const EmptyState(
                                  icon: Icons.search_off_rounded,
                                  title: 'لا توجد نتائج مطابقة لبحثك',
                                  description: 'يرجى التحقق من الكلمات الدلالية أو تصفح الكورسات الأخرى المتاحة',
                                )
                              else if (_segment == 1)
                                Column(
                                  children: [
                                    const EmptyState(
                                      icon: Icons.class_outlined,
                                      title: 'لم تشترك في أي دورة دراسية بعد',
                                      description: 'ادخل كود تفعيل الكورس أو تصفح الكورسات المتاحة للاشتراك.',
                                    ),
                                    const SizedBox(height: 12),
                                    ElevatedButton(
                                      onPressed: () {
                                        setState(() => _segment = 0);
                                        context.go('/courses');
                                      },
                                      child: const Text('استكشاف الكورسات', style: TextStyle(fontFamily: 'Cairo')),
                                    ),
                                  ],
                                )
                              else
                                const EmptyState(
                                  icon: Icons.school_outlined,
                                  title: 'لا توجد كورسات متاحة حالياً',
                                  description: 'تابعنا باستمرار، يتم إضافة كورسات جديدة',
                                ),
                            ],
                          );
                        }

                        return ListView.builder(
                          physics: const AlwaysScrollableScrollPhysics(),
                          padding: const EdgeInsets.only(bottom: 24),
                          itemCount: courses.length,
                          itemBuilder: (context, index) {
                            final course = courses[index];
                            final isSubscribed = _segment == 1 ||
                                state.myCourses.any((my) => my['id'] == course['id']);
                            return CourseCard(
                              course: course,
                              isSubscribed: isSubscribed,
                              onRefresh: _refresh,
                            );
                          },
                        );
                      }

                      if (state is CourseFailure) {
                        return ListView(
                          physics: const AlwaysScrollableScrollPhysics(),
                          children: [
                            const SizedBox(height: 80),
                            TabEmptyState(icon: Icons.wifi_off_rounded, message: state.message),
                            const SizedBox(height: 12),
                            Center(
                              child: ElevatedButton(
                                onPressed: _refresh,
                                child: const Text('إعادة المحاولة', style: TextStyle(fontFamily: 'Cairo')),
                              ),
                            ),
                          ],
                        );
                      }

                      return const SizedBox();
                    },
                  ),
                ),
        ),
      ],
    );
  }

  Widget _buildSegmentButton(ThemeData theme, String label, int value) {
    final bool selected = _segment == value;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _segment = value),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: selected ? AppTheme.primary : Colors.transparent,
            borderRadius: BorderRadius.circular(9),
          ),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontFamily: 'Cairo',
              fontSize: 13,
              fontWeight: selected ? FontWeight.bold : FontWeight.normal,
              color: selected ? Colors.white : theme.colorScheme.onSurface.withOpacity(0.6),
            ),
          ),
        ),
      ),
    );
  }
}
