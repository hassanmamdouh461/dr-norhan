import 'package:flutter/material.dart';

/// ---------------------------------------------------------------------------
/// فُصْحَى — الأستاذ أشرف سليم
/// Design System & Theme Tokens for Flutter (v2.0.0)
/// ---------------------------------------------------------------------------

class FushaColors {
  // Global Raw Primitives
  static const Color teal900 = Color(0xFF0B1A1B);
  static const Color teal800 = Color(0xFF163134); // Hero Brand Primary
  static const Color teal700 = Color(0xFF1E4347);
  static const Color teal600 = Color(0xFF28565B);
  static const Color teal500 = Color(0xFF37695C); // Arabic Emerald
  static const Color teal400 = Color(0xFF4E8777);

  static const Color sage600 = Color(0xFF4D6B54);
  static const Color sage500 = Color(0xFF62856A);
  static const Color sage400 = Color(0xFF7AA482);

  static const Color olive500 = Color(0xFF798963);
  static const Color olive400 = Color(0xFF92A578);

  static const Color gold500 = Color(0xFFE8B54A); // Accent Action
  static const Color brass600 = Color(0xFF918D58);
  static const Color sand300 = Color(0xFFB7B19B); // Logo Dot Khaki
  static const Color sand100 = Color(0xFFE8E5DC);

  static const Color canvasLight = Color(0xFFF8F9F7);
  static const Color surfaceLight = Color(0xFFFFFFFF);
  static const Color borderLight = Color(0xFFE2E6E3);

  // Status Feedback
  static const Color success = Color(0xFF1E6B37);
  static const Color successBg = Color(0xFFEAF6EE);
  static const Color warning = Color(0xFF8F5B00);
  static const Color warningBg = Color(0xFFFEF7E6);
  static const Color error = Color(0xFFA82315);
  static const Color errorBg = Color(0xFFFDF0EE);
}

class FushaTypography {
  static const String primaryFont = 'Avenir Arabic';
  static const String fallbackFont = 'Cairo';
  static const String poetryFont = 'Amiri';

  static const TextStyle heroDisplay = TextStyle(
    fontFamily: primaryFont,
    fontSize: 36,
    fontWeight: FontWeight.w800,
    height: 1.3,
    color: FushaColors.teal800,
  );

  static const TextStyle headingXl = TextStyle(
    fontFamily: primaryFont,
    fontSize: 28,
    fontWeight: FontWeight.w800,
    height: 1.3,
    color: FushaColors.teal800,
  );

  static const TextStyle headingLg = TextStyle(
    fontFamily: primaryFont,
    fontSize: 22,
    fontWeight: FontWeight.w700,
    height: 1.35,
    color: FushaColors.teal800,
  );

  static const TextStyle headingMd = TextStyle(
    fontFamily: primaryFont,
    fontSize: 18,
    fontWeight: FontWeight.w700,
    height: 1.4,
    color: FushaColors.teal800,
  );

  static const TextStyle bodyLarge = TextStyle(
    fontFamily: primaryFont,
    fontSize: 16,
    fontWeight: FontWeight.w500,
    height: 1.6,
    color: FushaColors.teal800,
  );

  static const TextStyle bodyMedium = TextStyle(
    fontFamily: primaryFont,
    fontSize: 14,
    fontWeight: FontWeight.w400,
    height: 1.5,
    color: Color(0xFF4A5554),
  );

  static const TextStyle caption = TextStyle(
    fontFamily: primaryFont,
    fontSize: 12,
    fontWeight: FontWeight.w400,
    height: 1.4,
    color: Color(0xFF748180),
  );

  static const TextStyle poetry = TextStyle(
    fontFamily: poetryFont,
    fontSize: 18,
    fontWeight: FontWeight.w600,
    height: 1.9,
    color: FushaColors.teal800,
  );
}

class FushaRadii {
  static const BorderRadius sm = BorderRadius.all(Radius.circular(6));
  static const BorderRadius md = BorderRadius.all(Radius.circular(12));
  static const BorderRadius lg = BorderRadius.all(Radius.circular(20));
  static const BorderRadius xl = BorderRadius.all(Radius.circular(32));
  static const BorderRadius full = BorderRadius.all(Radius.circular(9999));
}

class FushaTheme {
  static ThemeData get lightTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      scaffoldBackgroundColor: FushaColors.canvasLight,
      colorScheme: const ColorScheme.light(
        primary: FushaColors.teal800,
        secondary: FushaColors.teal500,
        tertiary: FushaColors.gold500,
        surface: FushaColors.surfaceLight,
        error: FushaColors.error,
        onPrimary: Colors.white,
        onSecondary: Colors.white,
        onSurface: FushaColors.teal800,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.white,
        foregroundColor: FushaColors.teal800,
        elevation: 0,
        centerTitle: true,
        titleTextStyle: TextStyle(
          fontFamily: FushaTypography.primaryFont,
          fontSize: 20,
          fontWeight: FontWeight.w700,
          color: FushaColors.teal800,
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: FushaColors.teal800,
          foregroundColor: Colors.white,
          minimumSize: const Size(double.infinity, 52),
          shape: const RoundedRectangleBorder(borderRadius: FushaRadii.md),
          elevation: 2,
          textStyle: const TextStyle(
            fontFamily: FushaTypography.primaryFont,
            fontSize: 16,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
      cardTheme: CardTheme(
        color: FushaColors.surfaceLight,
        elevation: 1,
        shape: const RoundedRectangleBorder(
          borderRadius: FushaRadii.lg,
          side: BorderSide(color: FushaColors.borderLight, width: 1),
        ),
      ),
    );
  }
}
