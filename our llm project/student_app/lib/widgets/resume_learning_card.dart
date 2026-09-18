import 'package:flutter/material.dart';
import '../config/theme.dart';
import '../screens/lesson_player_screen.dart';

class ResumeLearningCard extends StatelessWidget {
  final Map<String, dynamic> lastLesson;

  const ResumeLearningCard({
    super.key,
    required this.lastLesson,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    final String lessonId = lastLesson['lesson_id'] ?? '';
    final String lessonTitle = lastLesson['lesson_title'] ?? lastLesson['title'] ?? 'محاضرة لغة عربية';
    final String courseTitle = lastLesson['course_title'] ?? 'الكورس الحالي';
    final int position = lastLesson['position_seconds'] ?? lastLesson['position'] ?? 0;
    final int duration = lastLesson['duration_seconds'] ?? lastLesson['duration'] ?? 1;

    final double progress = (position / duration).clamp(0.0, 1.0);
    final String progressPct = '${(progress * 100).toStringAsFixed(0)}%';

    // Format remaining time or position
    final int minutesLeft = ((duration - position) / 60).ceil();
    final String remainingText = minutesLeft <= 0 ? 'مكتمل' : 'متبقي $minutesLeft دقيقة';

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: isDark
              ? [AppTheme.primary.withOpacity(0.15), AppTheme.surfaceCard]
              : [AppTheme.primary.withOpacity(0.06), Colors.white],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: AppTheme.primary.withOpacity(0.2),
          width: 1,
        ),
        boxShadow: isDark
            ? []
            : [
                BoxShadow(
                  color: AppTheme.primary.withOpacity(0.04),
                  blurRadius: 16,
                  offset: const Offset(0, 8),
                )
              ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: InkWell(
          onTap: () {
            if (lessonId.isNotEmpty) {
              Navigator.of(context).push(MaterialPageRoute(
                builder: (_) => LessonPlayerScreen(
                  lessonId: lessonId,
                  lessonTitle: lessonTitle,
                ),
              ));
            }
          },
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Top Badge & Action
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppTheme.primary.withOpacity(0.12),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Row(
                        children: [
                          Icon(Icons.play_circle_filled_rounded, size: 14, color: AppTheme.primary),
                          SizedBox(width: 4),
                          Text(
                            'أكمل التعلم',
                            style: TextStyle(
                              fontFamily: 'Cairo',
                              color: AppTheme.primary,
                              fontWeight: FontWeight.bold,
                              fontSize: 11,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const Spacer(),
                    Text(
                      remainingText,
                      style: TextStyle(
                        fontFamily: 'Cairo',
                        fontSize: 11,
                        color: isDark ? Colors.white38 : Colors.black45,
                      ),
                    ),
                  ],
                ),
                
                const SizedBox(height: 12),
                
                // Lesson Title
                Text(
                  lessonTitle,
                  style: TextStyle(
                    fontFamily: 'Cairo',
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: isDark ? Colors.white : Colors.black87,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                
                // Course Name
                Text(
                  courseTitle,
                  style: TextStyle(
                    fontFamily: 'Cairo',
                    fontSize: 12,
                    color: isDark ? Colors.white54 : Colors.black54,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                
                const SizedBox(height: 16),
                
                // Progress Bar
                Row(
                  children: [
                    Expanded(
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(4),
                        child: LinearProgressIndicator(
                          value: progress,
                          backgroundColor: isDark ? Colors.white10 : Colors.black.withOpacity(0.05),
                          valueColor: const AlwaysStoppedAnimation<Color>(AppTheme.primary),
                          minHeight: 6,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Text(
                      progressPct,
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: AppTheme.primary,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
