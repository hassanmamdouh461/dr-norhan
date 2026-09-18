import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

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

  static const Color gold500 = Color(0xFFE8B54A); // Accent Action / Sun Gold
  static const Color brass600 = Color(0xFF918D58);
  static const Color sand300 = Color(0xFFB7B19B); // Logo Dot Khaki
  static const Color sand100 = Color(0xFFE8E5DC);

  // Surfaces & Backgrounds
  static const Color canvasLight = Color(0xFFF8F9F7);
  static const Color surfaceLight = Color(0xFFFFFFFF);
  static const Color borderLight = Color(0xFFE2E6E3);

  static const Color canvasDark = Color(0xFF0D1D18);
  static const Color surfaceDark = Color(0xFF142B24);
  static const Color elevatedDark = Color(0xFF1E3E34);
  static const Color borderDark = Color(0xFF26493F);

  // Status Feedback
  static const Color success = Color(0xFF1E6B37);
  static const Color successBg = Color(0xFFEAF6EE);
  static const Color warning = Color(0xFF8F5B00);
  static const Color warningBg = Color(0xFFFEF7E6);
  static const Color error = Color(0xFFA82315);
  static const Color errorBg = Color(0xFFFDF0EE);
}

class FushaRadii {
  static const BorderRadius sm = BorderRadius.all(Radius.circular(6));
  static const BorderRadius md = BorderRadius.all(Radius.circular(12));
  static const BorderRadius lg = BorderRadius.all(Radius.circular(20));
  static const BorderRadius xl = BorderRadius.all(Radius.circular(32));
  static const BorderRadius full = BorderRadius.all(Radius.circular(9999));
}

class AppTheme {
  // ── Brand Colors (Fusha Design System) ──
  static const Color primary = FushaColors.teal800;          // #163134 Deep Forest Teal
  static const Color primaryDark = FushaColors.canvasDark;      // #0D1D18 Dark Forest
  static const Color secondary = FushaColors.teal500;        // #37695C Emerald Teal
  static const Color accent = FushaColors.gold500;           // #E8B54A Sun Gold
  static const Color khaki = FushaColors.sand300;            // #B7B19B Sand Khaki
  static const Color sage = FushaColors.sage500;             // #62856A Sage
  static const Color olive = FushaColors.olive500;           // #798963 Olive

  // Dark Mode Surfaces
  static const Color surface = FushaColors.canvasDark;       // #0D1D18
  static const Color surfaceCard = FushaColors.surfaceDark;   // #142B24
  static const Color surfaceElevated = FushaColors.elevatedDark; // #1E3E34
  static const Color background = FushaColors.canvasDark;    // #0D1D18

  // Text Colors
  static const Color textPrimary = Color(0xFFF8FAFC);
  static const Color textSecondary = FushaColors.sand300;
  static const Color textMuted = Color(0xFF8A9A92);

  // Status Colors
  static const Color success = FushaColors.success;
  static const Color warning = FushaColors.warning;
  static const Color error = FushaColors.error;

  static const LinearGradient primaryGradient = LinearGradient(
    colors: [FushaColors.teal800, FushaColors.teal500],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient goldGradient = LinearGradient(
    colors: [Color(0xFFE8B54A), Color(0xFFC79232)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient heroGradient = LinearGradient(
    colors: [FushaColors.canvasDark, FushaColors.teal800],
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
  );

  // ── Arabic Typography ──
  static TextStyle get arabicHeadline => GoogleFonts.cairo(
    fontSize: 28,
    fontWeight: FontWeight.w800,
    height: 1.3,
    letterSpacing: 0,
  );

  static TextStyle get arabicTitle => GoogleFonts.cairo(
    fontSize: 18,
    fontWeight: FontWeight.w700,
    height: 1.4,
    letterSpacing: 0,
  );

  static TextStyle get arabicBody => GoogleFonts.cairo(
    fontSize: 16,
    fontWeight: FontWeight.w500,
    height: 1.6,
    letterSpacing: 0,
  );

  static TextStyle get arabicCaption => GoogleFonts.cairo(
    fontSize: 12,
    fontWeight: FontWeight.w400,
    height: 1.5,
    letterSpacing: 0,
  );

  static TextStyle get arabicPoetry => GoogleFonts.amiri(
    fontSize: 18,
    fontWeight: FontWeight.w600,
    height: 1.9,
    letterSpacing: 0,
  );

  // ── Dark Theme (Fusha Dark Forest) ──
  static ThemeData get darkTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: surface,
      colorScheme: const ColorScheme.dark(
        primary: accent,               // Gold accent for interactive highlights in dark mode
        onPrimary: FushaColors.teal900,
        secondary: secondary,
        onSecondary: Colors.white,
        tertiary: khaki,
        surface: surfaceCard,
        onSurface: textPrimary,
        error: error,
        surfaceContainerHighest: surfaceCard,
        surfaceContainer: surfaceElevated,
      ),

      textTheme: GoogleFonts.cairoTextTheme(
        ThemeData.dark().textTheme.copyWith(
          headlineLarge: arabicHeadline.copyWith(color: textPrimary),
          headlineMedium: arabicHeadline.copyWith(fontSize: 22, color: textPrimary),
          titleLarge: arabicTitle.copyWith(color: textPrimary),
          titleMedium: arabicTitle.copyWith(fontSize: 16, color: textPrimary),
          bodyLarge: arabicBody.copyWith(color: textPrimary),
          bodyMedium: arabicBody.copyWith(fontSize: 14, color: textSecondary),
          bodySmall: arabicCaption.copyWith(color: textMuted),
          labelLarge: arabicTitle.copyWith(fontSize: 14, color: accent),
        ),
      ),

      appBarTheme: const AppBarTheme(
        backgroundColor: surface,
        elevation: 0,
        centerTitle: true,
        iconTheme: IconThemeData(color: accent),
        titleTextStyle: TextStyle(
          fontFamily: 'Cairo',
          fontSize: 18,
          fontWeight: FontWeight.w700,
          color: textPrimary,
        ),
      ),

      cardTheme: CardThemeData(
        color: surfaceCard,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: const BorderSide(color: FushaColors.borderDark, width: 1),
        ),
      ),

      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: accent,
          foregroundColor: FushaColors.teal900,
          elevation: 2,
          minimumSize: const Size(double.infinity, 52),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          textStyle: GoogleFonts.cairo(fontSize: 16, fontWeight: FontWeight.w800),
        ),
      ),

      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surfaceElevated,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: FushaColors.borderDark),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: FushaColors.borderDark),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: accent, width: 2),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        hintStyle: const TextStyle(color: textMuted, fontFamily: 'Cairo'),
      ),

      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: surfaceCard,
        selectedItemColor: accent,
        unselectedItemColor: textMuted,
        type: BottomNavigationBarType.fixed,
        elevation: 0,
      ),

      snackBarTheme: SnackBarThemeData(
        backgroundColor: surfaceElevated,
        contentTextStyle: const TextStyle(color: textPrimary, fontFamily: 'Cairo'),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        behavior: SnackBarBehavior.floating,
      ),

      dialogTheme: DialogThemeData(
        backgroundColor: surfaceCard,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: const BorderSide(color: FushaColors.borderDark),
        ),
      ),
    );
  }

  // ── Light Theme (Fusha Canvas Light & Forest Teal) ──
  static ThemeData get lightTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      scaffoldBackgroundColor: FushaColors.canvasLight,
      colorScheme: const ColorScheme.light(
        primary: primary,             // Forest Teal
        onPrimary: Colors.white,
        secondary: secondary,
        onSecondary: Colors.white,
        tertiary: accent,              // Sun Gold
        surface: Colors.white,
        onSurface: primary,
        error: error,
        surfaceContainerHighest: Color(0xFFF3F5F2),
        surfaceContainer: Color(0xFFEBEFEA),
      ),

      textTheme: GoogleFonts.cairoTextTheme(
        ThemeData.light().textTheme.copyWith(
          headlineLarge: arabicHeadline.copyWith(color: primary),
          headlineMedium: arabicHeadline.copyWith(fontSize: 22, color: primary),
          titleLarge: arabicTitle.copyWith(color: primary),
          titleMedium: arabicTitle.copyWith(fontSize: 16, color: primary),
          bodyLarge: arabicBody.copyWith(color: primary),
          bodyMedium: arabicBody.copyWith(fontSize: 14, color: Color(0xFF4A5554)),
          bodySmall: arabicCaption.copyWith(color: Color(0xFF748180)),
          labelLarge: arabicTitle.copyWith(fontSize: 14, color: primary),
        ),
      ),

      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.white,
        elevation: 0,
        centerTitle: true,
        iconTheme: IconThemeData(color: primary),
        titleTextStyle: TextStyle(
          fontFamily: 'Cairo',
          fontSize: 18,
          fontWeight: FontWeight.w700,
          color: primary,
        ),
      ),

      cardTheme: CardThemeData(
        color: Colors.white,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: const BorderSide(color: FushaColors.borderLight, width: 1),
        ),
      ),

      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primary,
          foregroundColor: Colors.white,
          elevation: 2,
          minimumSize: const Size(double.infinity, 52),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          textStyle: GoogleFonts.cairo(fontSize: 16, fontWeight: FontWeight.w800),
        ),
      ),

      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: FushaColors.borderLight),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: FushaColors.borderLight),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: primary, width: 2),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        hintStyle: const TextStyle(color: Color(0xFF748180), fontFamily: 'Cairo'),
      ),

      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: Colors.white,
        selectedItemColor: primary,
        unselectedItemColor: Color(0xFF8A9A92),
        type: BottomNavigationBarType.fixed,
        elevation: 0,
      ),

      snackBarTheme: SnackBarThemeData(
        backgroundColor: primary,
        contentTextStyle: const TextStyle(color: Colors.white, fontFamily: 'Cairo'),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        behavior: SnackBarBehavior.floating,
      ),

      dialogTheme: DialogThemeData(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: const BorderSide(color: FushaColors.borderLight),
        ),
      ),
    );
  }
}
