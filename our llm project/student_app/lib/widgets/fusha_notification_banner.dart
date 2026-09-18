import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

enum FushaNotificationType {
  info,
  success,
  warning,
  error,
}

/// A luxury floating in-app notification banner styled with the Fusha Design System.
class FushaNotificationBanner {
  static OverlayEntry? _currentEntry;
  static Timer? _dismissTimer;

  static void show(
    BuildContext context, {
    required String title,
    required String message,
    FushaNotificationType type = FushaNotificationType.info,
    Duration duration = const Duration(seconds: 4),
    VoidCallback? onTap,
  }) {
    // Haptic feedback
    HapticFeedback.lightImpact();

    // Dismiss existing notification if any
    dismiss();

    final overlay = Overlay.maybeOf(context, rootOverlay: true);
    if (overlay == null) return;

    _currentEntry = OverlayEntry(
      builder: (context) => _NotificationBannerWidget(
        title: title,
        message: message,
        type: type,
        onDismiss: dismiss,
        onTap: onTap,
      ),
    );

    overlay.insert(_currentEntry!);

    _dismissTimer = Timer(duration, () {
      dismiss();
    });
  }

  static void dismiss() {
    _dismissTimer?.cancel();
    _dismissTimer = null;
    _currentEntry?.remove();
    _currentEntry = null;
  }
}

class _NotificationBannerWidget extends StatefulWidget {
  final String title;
  final String message;
  final FushaNotificationType type;
  final VoidCallback onDismiss;
  final VoidCallback? onTap;

  const _NotificationBannerWidget({
    required this.title,
    required this.message,
    required this.type,
    required this.onDismiss,
    this.onTap,
  });

  @override
  State<_NotificationBannerWidget> createState() => _NotificationBannerWidgetState();
}

class _NotificationBannerWidgetState extends State<_NotificationBannerWidget>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<Offset> _offsetAnimation;
  late final Animation<double> _opacityAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    );

    _offsetAnimation = Tween<Offset>(
      begin: const Offset(0.0, -1.2),
      end: Offset.zero,
    ).animate(CurvedAnimation(
      parent: _controller,
      curve: Curves.easeOutCubic,
    ));

    _opacityAnimation = Tween<double>(
      begin: 0.0,
      end: 1.0,
    ).animate(CurvedAnimation(
      parent: _controller,
      curve: Curves.easeOut,
    ));

    _controller.forward();
  }

  Future<void> _handleDismiss() async {
    await _controller.reverse();
    widget.onDismiss();
  }

  Color _getAccentColor() {
    switch (widget.type) {
      case FushaNotificationType.success:
        return const Color(0xFF5F7A61); // Sage
      case FushaNotificationType.warning:
        return const Color(0xFFE8B54A); // Sun Gold
      case FushaNotificationType.error:
        return const Color(0xFFD9534F); // Crimson
      case FushaNotificationType.info:
        return const Color(0xFFE8B54A); // Sun Gold
    }
  }

  IconData _getIcon() {
    switch (widget.type) {
      case FushaNotificationType.success:
        return Icons.check_circle_outline_rounded;
      case FushaNotificationType.warning:
        return Icons.warning_amber_rounded;
      case FushaNotificationType.error:
        return Icons.error_outline_rounded;
      case FushaNotificationType.info:
        return Icons.notifications_active_outlined;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final topPadding = MediaQuery.of(context).padding.top;
    final accentColor = _getAccentColor();

    return Positioned(
      top: topPadding + 8,
      left: 16,
      right: 16,
      child: Material(
        color: Colors.transparent,
        child: SlideTransition(
          position: _offsetAnimation,
          child: FadeTransition(
            opacity: _opacityAnimation,
            child: Dismissible(
              key: const Key('fusha_banner'),
              direction: DismissDirection.up,
              onDismissed: (_) => widget.onDismiss(),
              child: GestureDetector(
                onTap: () {
                  if (widget.onTap != null) {
                    widget.onTap!();
                  }
                  _handleDismiss();
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  decoration: BoxDecoration(
                    color: const Color(0xFF142B24).withOpacity(0.96),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: accentColor.withOpacity(0.6), width: 1.2),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.4),
                        blurRadius: 18,
                        offset: const Offset(0, 8),
                      ),
                      BoxShadow(
                        color: accentColor.withOpacity(0.12),
                        blurRadius: 12,
                        spreadRadius: 1,
                      ),
                    ],
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: accentColor.withOpacity(0.16),
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          _getIcon(),
                          color: accentColor,
                          size: 22,
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              widget.title,
                              style: GoogleFonts.cairo(
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              widget.message,
                              style: GoogleFonts.cairo(
                                fontSize: 11.5,
                                color: const Color(0xFFB7B19B), // Khaki
                                height: 1.3,
                              ),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      IconButton(
                        icon: const Icon(Icons.close, size: 18, color: Colors.white38),
                        onPressed: _handleDismiss,
                        splashRadius: 16,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
