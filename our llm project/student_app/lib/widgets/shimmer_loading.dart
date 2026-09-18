import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';
import '../config/theme.dart';

class ShimmerLoading extends StatelessWidget {
  final double width;
  final double height;
  final double borderRadius;

  const ShimmerLoading({
    super.key,
    required this.width,
    required this.height,
    this.borderRadius = 12.0,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    return Shimmer.fromColors(
      baseColor: isDark ? AppTheme.surfaceCard : Colors.grey[300]!,
      highlightColor: isDark ? AppTheme.surfaceElevated : Colors.grey[100]!,
      child: Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(borderRadius),
        ),
      ),
    );
  }

  // Predefined cards shimmer configurations
  static Widget courseCardList() {
    return ListView.separated(
      itemCount: 4,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      separatorBuilder: (context, index) => const SizedBox(height: 16),
      itemBuilder: (context, index) => const Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ShimmerLoading(width: 100, height: 100, borderRadius: 12),
          SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(height: 8),
                ShimmerLoading(width: double.infinity, height: 18),
                SizedBox(height: 8),
                ShimmerLoading(width: 120, height: 14),
                SizedBox(height: 12),
                ShimmerLoading(width: 80, height: 12),
              ],
            ),
          )
        ],
      ),
    );
  }
}
