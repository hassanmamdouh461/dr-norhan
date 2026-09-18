import 'package:flutter/material.dart';
import '../config/theme.dart';
import 'fusha_palette_transition.dart';

class AppLoadingIndicator extends StatefulWidget {
  final double size;
  final Color? color;
  final Color? secondaryColor;

  const AppLoadingIndicator({
    super.key,
    this.size = 40,
    this.color,
    this.secondaryColor,
  });

  @override
  State<AppLoadingIndicator> createState() => _AppLoadingIndicatorState();
}

class _AppLoadingIndicatorState extends State<AppLoadingIndicator>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final FushaPaletteColorPair _randomPair;

  @override
  void initState() {
    super.initState();
    _randomPair = FushaPaletteTransitions.pickRandomPair();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1100),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final primaryColor = widget.color ?? _randomPair.primary;
    final goldColor = widget.secondaryColor ?? FushaColors.gold500;

    return RotationTransition(
      turns: _controller,
      child: Stack(
        alignment: Alignment.center,
        children: [
          // Outer rotating elegant progress arc
          SizedBox(
            width: widget.size,
            height: widget.size,
            child: CircularProgressIndicator(
              value: 0.82,
              strokeWidth: 3.2,
              valueColor: AlwaysStoppedAnimation<Color>(goldColor),
              backgroundColor: primaryColor.withValues(alpha: 0.2),
              strokeCap: StrokeCap.round,
            ),
          ),
          // Inner glowing pulsing gold dot with palette highlight
          Container(
            width: widget.size * 0.32,
            height: widget.size * 0.32,
            decoration: BoxDecoration(
              color: goldColor,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: goldColor.withValues(alpha: 0.55),
                  blurRadius: 8,
                  spreadRadius: 2,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
