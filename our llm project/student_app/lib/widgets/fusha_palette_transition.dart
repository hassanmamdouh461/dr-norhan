import 'dart:math';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// Representation of a transition color pair from the Fusha Web platform.
class FushaPaletteColorPair {
  final Color primary;
  final Color secondary;
  final String name;

  const FushaPaletteColorPair({
    required this.primary,
    required this.secondary,
    required this.name,
  });
}

/// The exact 7 transition color pairs from the Fusha web platform (SECTION_TRANSITION_PAIRS).
class FushaPaletteTransitions {
  static const List<FushaPaletteColorPair> pairs = [
    FushaPaletteColorPair(
      primary: Color(0xFF142B24), // Forest Dark
      secondary: Color(0xFFB7B19B), // Khaki
      name: 'Forest Dark & Khaki',
    ),
    FushaPaletteColorPair(
      primary: Color(0xFF1E3E34), // Forest Light
      secondary: Color(0xFFB7B19B), // Khaki
      name: 'Forest Light & Khaki',
    ),
    FushaPaletteColorPair(
      primary: Color(0xFF5F7A61), // Sage Green
      secondary: Color(0xFF142B24), // Forest Dark
      name: 'Sage & Forest',
    ),
    FushaPaletteColorPair(
      primary: Color(0xFF8B9565), // Olive
      secondary: Color(0xFF142B24), // Forest Dark
      name: 'Olive & Forest',
    ),
    FushaPaletteColorPair(
      primary: Color(0xFF142B24), // Forest Dark
      secondary: Color(0xFF5F7A61), // Sage Green
      name: 'Forest & Sage',
    ),
    FushaPaletteColorPair(
      primary: Color(0xFFB7B19B), // Khaki
      secondary: Color(0xFF142B24), // Forest Dark
      name: 'Khaki & Forest',
    ),
    FushaPaletteColorPair(
      primary: Color(0xFF142B24), // Forest Dark
      secondary: Color(0xFF1E3E34), // Forest Light
      name: 'Forest Dark & Light',
    ),
  ];

  static int _lastIdx = -1;

  /// Picks a random color pair, ensuring no immediate repetition
  static FushaPaletteColorPair pickRandomPair() {
    if (pairs.isEmpty) {
      return const FushaPaletteColorPair(
        primary: Color(0xFF142B24),
        secondary: Color(0xFFE8B54A),
        name: 'Default Gold',
      );
    }
    int idx;
    final random = Random();
    do {
      idx = random.nextInt(pairs.length);
    } while (idx == _lastIdx && pairs.length > 1);
    _lastIdx = idx;
    return pairs[idx];
  }
}

/// Custom GoRouter Transition Page that implements the random-color transition
/// matching the Fusha Web platform's section transition.
class FushaPaletteTransitionPage<T> extends CustomTransitionPage<T> {
  FushaPaletteTransitionPage({
    required super.child,
    super.key,
    super.name,
    super.arguments,
    super.restorationId,
  }) : super(
          transitionDuration: const Duration(milliseconds: 380),
          reverseTransitionDuration: const Duration(milliseconds: 300),
          transitionsBuilder: (context, animation, secondaryAnimation, child) {
            final pair = FushaPaletteTransitions.pickRandomPair();

            final curvedAnimation = CurvedAnimation(
              parent: animation,
              curve: Curves.easeOutCubic,
              reverseCurve: Curves.easeInCubic,
            );

            final scaleAnimation = Tween<double>(
              begin: 0.96,
              end: 1.0,
            ).animate(curvedAnimation);

            final fadeAnimation = Tween<double>(
              begin: 0.0,
              end: 1.0,
            ).animate(CurvedAnimation(
              parent: animation,
              curve: const Interval(0.2, 1.0, curve: Curves.easeOut),
            ));

            // Color curtain sweep effect
            final curtainAnimation = Tween<double>(
              begin: 1.0,
              end: 0.0,
            ).animate(CurvedAnimation(
              parent: animation,
              curve: const Interval(0.0, 0.75, curve: Curves.easeInOutCubic),
            ));

            return Stack(
              children: [
                FadeTransition(
                  opacity: fadeAnimation,
                  child: ScaleTransition(
                    scale: scaleAnimation,
                    child: child,
                  ),
                ),
                // Animated dual-color wave sweep
                AnimatedBuilder(
                  animation: curtainAnimation,
                  builder: (context, _) {
                    if (curtainAnimation.value <= 0.01) {
                      return const SizedBox.shrink();
                    }
                    return IgnorePointer(
                      child: ClipPath(
                        clipper: _CurtainWaveClipper(progress: curtainAnimation.value),
                        child: Container(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.topRight,
                              end: Alignment.bottomLeft,
                              colors: [
                                pair.primary.withOpacity(0.92),
                                pair.secondary.withOpacity(0.85),
                              ],
                            ),
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ],
            );
          },
        );
}

class _CurtainWaveClipper extends CustomClipper<Path> {
  final double progress;

  _CurtainWaveClipper({required this.progress});

  @override
  Path getClip(Size size) {
    final path = Path();
    final width = size.width;
    final height = size.height;

    // Sweeps from top-right to bottom-left (Arabic RTL natural flow)
    final sweepX = width * progress;
    path.moveTo(0, 0);
    path.lineTo(sweepX, 0);
    path.quadraticBezierTo(
      sweepX * 0.7,
      height * 0.5,
      sweepX * 0.3,
      height,
    );
    path.lineTo(0, height);
    path.close();

    return path;
  }

  @override
  bool shouldReclip(covariant _CurtainWaveClipper oldClipper) {
    return oldClipper.progress != progress;
  }
}
