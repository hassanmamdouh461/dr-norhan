import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:shimmer/shimmer.dart';

import '../../blocs/auth/auth_bloc.dart';
import '../../config/theme.dart';
import '../../widgets/app_loading_indicator.dart';

/// Shared header used by all dashboard tabs: drawer button, title,
/// notifications bell.
class TabHeader extends StatelessWidget {
  final String title;
  final bool isGuest;
  final List<Widget> extraActions;

  const TabHeader({
    super.key,
    required this.title,
    required this.isGuest,
    this.extraActions = const [],
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              IconButton(
                icon: Icon(Icons.menu, color: theme.colorScheme.onSurface, size: 28),
                onPressed: () => Scaffold.of(context).openDrawer(),
              ),
              const SizedBox(width: 8),
              Text(
                title,
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: theme.colorScheme.onSurface,
                  fontFamily: 'Cairo',
                ),
              ),
            ],
          ),
          Row(
            children: [
              ...extraActions,
              IconButton(
                icon: Icon(Icons.notifications_outlined, color: theme.colorScheme.onSurface),
                onPressed: () => showNotificationsSheet(context, isGuest: isGuest),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Bottom sheet listing student notifications (real API).
void showNotificationsSheet(BuildContext context, {required bool isGuest}) {
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Theme.of(context).cardTheme.color ?? Theme.of(context).colorScheme.surface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (ctx) => Directionality(
      textDirection: TextDirection.rtl,
      child: _NotificationsSheet(isGuest: isGuest),
    ),
  );
}

class _NotificationsSheet extends StatefulWidget {
  final bool isGuest;
  const _NotificationsSheet({required this.isGuest});

  @override
  State<_NotificationsSheet> createState() => _NotificationsSheetState();
}

class _NotificationsSheetState extends State<_NotificationsSheet> {
  Future<Map<String, dynamic>>? _future;

  @override
  void initState() {
    super.initState();
    if (!widget.isGuest) {
      _future = context.read<AuthBloc>().apiService.getNotifications();
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return SizedBox(
      height: MediaQuery.of(context).size.height * 0.6,
      child: Padding(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'الإشعارات والتحديثات',
                  style: TextStyle(
                    color: theme.colorScheme.onSurface,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    fontFamily: 'Cairo',
                  ),
                ),
                IconButton(
                  icon: Icon(Icons.close, color: theme.colorScheme.onSurface.withOpacity(0.54)),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
            Divider(color: theme.colorScheme.onSurface.withOpacity(0.1)),
            Expanded(
              child: widget.isGuest
                  ? _buildEmpty(theme, Icons.lock_outline, 'سجّل الدخول لعرض إشعاراتك')
                  : FutureBuilder<Map<String, dynamic>>(
                      future: _future,
                      builder: (context, snapshot) {
                        if (snapshot.connectionState == ConnectionState.waiting) {
                          return const Center(child: AppLoadingIndicator());
                        }
                        final list = snapshot.data?['notifications'] as List? ?? [];
                        if (snapshot.hasError || list.isEmpty) {
                          return _buildEmpty(theme, Icons.notifications_none_outlined, 'لا توجد إشعارات جديدة حالياً');
                        }
                        return ListView.separated(
                          itemCount: list.length,
                          separatorBuilder: (_, __) =>
                              Divider(color: theme.colorScheme.onSurface.withOpacity(0.06), height: 1),
                          itemBuilder: (context, idx) {
                            final n = list[idx];
                            final bool isRead = n['is_read'] == 1 || n['is_read'] == true;
                            DateTime? sentAt;
                            try {
                              sentAt = DateTime.parse(n['sent_at'] ?? n['created_at'] ?? '').toLocal();
                            } catch (_) {}

                            return ListTile(
                              contentPadding: EdgeInsets.zero,
                              leading: Container(
                                width: 40,
                                height: 40,
                                decoration: BoxDecoration(
                                  color: AppTheme.primary.withOpacity(isRead ? 0.06 : 0.14),
                                  shape: BoxShape.circle,
                                ),
                                child: Icon(
                                  isRead ? Icons.notifications_none : Icons.notifications_active,
                                  color: AppTheme.primary,
                                  size: 20,
                                ),
                              ),
                              title: Text(
                                n['title'] ?? 'إشعار',
                                style: TextStyle(
                                  color: theme.colorScheme.onSurface,
                                  fontSize: 13,
                                  fontWeight: isRead ? FontWeight.normal : FontWeight.bold,
                                  fontFamily: 'Cairo',
                                ),
                              ),
                              subtitle: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  if ((n['body'] ?? '').toString().isNotEmpty)
                                    Text(
                                      n['body'],
                                      style: TextStyle(
                                        color: theme.colorScheme.onSurface.withOpacity(0.6),
                                        fontSize: 12,
                                        fontFamily: 'Cairo',
                                      ),
                                    ),
                                  if (sentAt != null)
                                    Text(
                                      '${sentAt.year}/${sentAt.month}/${sentAt.day}',
                                      style: TextStyle(
                                        color: theme.colorScheme.onSurface.withOpacity(0.35),
                                        fontSize: 10,
                                        fontFamily: 'Cairo',
                                      ),
                                    ),
                                ],
                              ),
                              trailing: isRead
                                  ? null
                                  : Container(
                                      width: 8,
                                      height: 8,
                                      decoration: const BoxDecoration(
                                        color: AppTheme.primary,
                                        shape: BoxShape.circle,
                                      ),
                                    ),
                              onTap: isRead
                                  ? null
                                  : () async {
                                      try {
                                        await context
                                            .read<AuthBloc>()
                                            .apiService
                                            .markNotificationRead(n['id'].toString());
                                        if (mounted) {
                                          setState(() {
                                            _future = context.read<AuthBloc>().apiService.getNotifications();
                                          });
                                        }
                                      } catch (_) {}
                                    },
                            );
                          },
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmpty(ThemeData theme, IconData icon, String message) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 48, color: theme.colorScheme.onSurface.withOpacity(0.24)),
          const SizedBox(height: 12),
          Text(
            message,
            style: TextStyle(
              color: theme.colorScheme.onSurface.withOpacity(0.38),
              fontFamily: 'Cairo',
              fontSize: 13,
            ),
          ),
        ],
      ),
    );
  }
}

/// Full-tab prompt asking guests to log in (used by auth-only tabs).
class LoginPromptView extends StatelessWidget {
  final String title;
  final String description;
  final IconData icon;

  const LoginPromptView({
    super.key,
    this.title = 'هذا القسم يتطلب تسجيل الدخول',
    this.description = 'سجّل دخولك أو أنشئ حساباً جديداً للوصول إلى هذا القسم ومتابعة تقدمك الدراسي.',
    this.icon = Icons.lock_outline,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: AppTheme.primary.withOpacity(0.08),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 48, color: AppTheme.primary),
            ),
            const SizedBox(height: 20),
            Text(
              title,
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: theme.colorScheme.onSurface,
                fontFamily: 'Cairo',
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              description,
              style: TextStyle(
                fontSize: 13,
                color: theme.colorScheme.onSurface.withOpacity(0.5),
                fontFamily: 'Cairo',
                height: 1.6,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: () => context.go('/login'),
              icon: const Icon(Icons.login),
              label: const Text(
                'تسجيل الدخول',
                style: TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.bold),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.primary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Simple centered empty state.
class TabEmptyState extends StatelessWidget {
  final IconData icon;
  final String message;

  const TabEmptyState({super.key, required this.icon, required this.message});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 48, color: theme.colorScheme.onSurface.withOpacity(0.24)),
          const SizedBox(height: 12),
          Text(
            message,
            style: TextStyle(
              color: theme.colorScheme.onSurface.withOpacity(0.4),
              fontSize: 13,
              fontFamily: 'Cairo',
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

/// Shimmer placeholder for vertical course/list cards.
class ShimmerVerticalList extends StatelessWidget {
  final int itemCount;
  const ShimmerVerticalList({super.key, this.itemCount = 3});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final shimmerBase = isDark ? Colors.white.withOpacity(0.05) : Colors.grey.shade200;
    final shimmerHighlight = isDark ? Colors.white.withOpacity(0.12) : Colors.grey.shade50;

    return ListView.builder(
      physics: const NeverScrollableScrollPhysics(),
      shrinkWrap: true,
      itemCount: itemCount,
      itemBuilder: (ctx, idx) => Container(
        height: 100,
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: isDark ? AppTheme.surfaceCard : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: isDark ? Colors.white10 : Colors.black.withOpacity(0.04)),
        ),
        child: Shimmer.fromColors(
          baseColor: shimmerBase,
          highlightColor: shimmerHighlight,
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      height: 14,
                      width: 160,
                      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(4)),
                    ),
                    const SizedBox(height: 8),
                    Container(
                      height: 10,
                      width: 100,
                      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(4)),
                    ),
                    const SizedBox(height: 8),
                    Container(
                      height: 10,
                      width: 60,
                      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(4)),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Container(
                width: 90,
                height: 76,
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
