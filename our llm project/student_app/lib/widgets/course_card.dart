import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../config/theme.dart';
import '../screens/course_details_screen.dart';

class CourseCard extends StatelessWidget {
  final Map<String, dynamic> course;
  final bool isSubscribed;
  final VoidCallback? onRefresh;

  const CourseCard({
    super.key,
    required this.course,
    required this.isSubscribed,
    this.onRefresh,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    final String coverUrl = course['cover_image'] ?? course['cover_url'] ?? '';
    final String title = course['title'] ?? 'دورة في اللغة العربية';
    final String grade = course['grade'] ?? '3 ثانوي';
    final int? lessonsCount = course['lessons_count'] ?? course['lessons']?.length;
    final priceVal = course['reference_price'];
    final isFree = course['is_free'] == 1 || (priceVal == null || priceVal == 0);
    final String priceStr = isFree ? 'متاح مجاناً' : '${(priceVal / 100).toStringAsFixed(0)} جنيه';

    return GestureDetector(
      onTap: () {
        Navigator.of(context).push(MaterialPageRoute(
          builder: (_) => CourseDetailsScreen(courseId: course['id']),
        )).then((_) {
          onRefresh?.call();
        });
      },
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: isDark ? AppTheme.surfaceCard : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isFree
                ? Colors.teal.withOpacity(0.2)
                : (isSubscribed ? AppTheme.primary.withOpacity(0.3) : theme.colorScheme.onSurface.withOpacity(0.06)),
            width: 1,
          ),
          boxShadow: isDark
              ? []
              : [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.03),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  )
                ],
        ),
        child: Padding(
          padding: const EdgeInsets.all(12.0),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              // Course Thumbnail Image (Left side)
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Container(
                  width: 90,
                  height: 90,
                  color: isDark ? Colors.white.withOpacity(0.05) : Colors.black.withOpacity(0.05),
                  child: coverUrl.isNotEmpty
                      ? CachedNetworkImage(
                          imageUrl: coverUrl,
                          fit: BoxFit.cover,
                          errorWidget: (ctx, url, err) => const Center(
                            child: Icon(Icons.school, color: AppTheme.primary, size: 32),
                          ),
                        )
                      : const Center(
                          child: Icon(Icons.school, color: AppTheme.primary, size: 32),
                        ),
                ),
              ),
              const SizedBox(width: 16),
              
              // Course Details (Right side in RTL)
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Subscription status Badge
                    if (isSubscribed)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppTheme.primary.withOpacity(0.12),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: const Text(
                          'مشترك',
                          style: TextStyle(
                            fontFamily: 'Cairo',
                            color: AppTheme.primary,
                            fontWeight: FontWeight.bold,
                            fontSize: 10,
                          ),
                        ),
                      )
                    else if (isFree)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.teal.withOpacity(0.12),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: const Text(
                          'مجاني',
                          style: TextStyle(
                            fontFamily: 'Cairo',
                            color: Colors.teal,
                            fontWeight: FontWeight.bold,
                            fontSize: 10,
                          ),
                        ),
                      ),
                    
                    const SizedBox(height: 6),
                    
                    // Course Title
                    Text(
                      title,
                      style: TextStyle(
                        fontFamily: 'Cairo',
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                        color: isDark ? Colors.white : Colors.black87,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 6),
                    
                    // Price / Grade / Lesson count
                    Row(
                      children: [
                        Text(
                          isSubscribed ? 'تم الاشتراك' : priceStr,
                          style: TextStyle(
                            fontFamily: 'Cairo',
                            color: isSubscribed
                                ? (isDark ? Colors.white60 : Colors.black54)
                                : AppTheme.primary,
                            fontWeight: isSubscribed ? FontWeight.normal : FontWeight.bold,
                            fontSize: 12,
                          ),
                        ),
                        Text(
                          ' • $grade',
                          style: TextStyle(
                            fontFamily: 'Cairo',
                            color: isDark ? Colors.white30 : Colors.black38,
                            fontSize: 11,
                          ),
                        ),
                        if (lessonsCount != null)
                          Text(
                            ' • $lessonsCount درس',
                            style: TextStyle(
                              fontFamily: 'Cairo',
                              color: isDark ? Colors.white30 : Colors.black38,
                              fontSize: 11,
                            ),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
              
              // Arrow Indicator
              Icon(
                Icons.arrow_forward_ios_rounded,
                size: 16,
                color: isDark ? Colors.white24 : Colors.black26,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
