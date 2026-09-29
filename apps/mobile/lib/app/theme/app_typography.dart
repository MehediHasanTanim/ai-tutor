import 'package:flutter/material.dart';

/// Type scale.
///
/// Noto Sans Bengali is the single family for both scripts, bundled rather
/// than downloaded. Two reasons, both from the docs:
///
/// - Doc 07 flags Bangla conjunct rendering as something to verify on a real
///   low-end device. One family that handles যুক্তাক্ষর correctly and also
///   carries Latin means mixed Bangla/English lines — which is most lines in
///   this product, since scientific terms stay in English — share a baseline
///   and weight instead of visibly switching font mid-sentence.
/// - Doc 05 §11 asks for large, readable type. The scale below starts a step
///   above Material's default because Bangla conjuncts carry more vertical
///   detail than Latin and lose legibility sooner as size drops.
class AppTypography {
  const AppTypography._();

  static const String fontFamily = 'NotoSansBengali';

  /// Bangla sits lower and taller in its em box than Latin. The default
  /// Material line heights clip descenders on conjuncts, so every style here
  /// sets its own.
  static const double _tightHeight = 1.30;
  static const double _bodyHeight = 1.55;

  static TextTheme textTheme(Color onSurface) {
    return TextTheme(
      displayLarge: _style(32, FontWeight.w700, _tightHeight, onSurface),
      displayMedium: _style(28, FontWeight.w700, _tightHeight, onSurface),
      displaySmall: _style(25, FontWeight.w600, _tightHeight, onSurface),

      headlineLarge: _style(24, FontWeight.w600, _tightHeight, onSurface),
      headlineMedium: _style(22, FontWeight.w600, _tightHeight, onSurface),
      headlineSmall: _style(20, FontWeight.w600, _tightHeight, onSurface),

      titleLarge: _style(19, FontWeight.w600, 1.4, onSurface),
      titleMedium: _style(17, FontWeight.w500, 1.4, onSurface),
      titleSmall: _style(15, FontWeight.w500, 1.4, onSurface),

      // 17/15 rather than Material's 16/14. Worth the extra point for a
      // student reading an explanation on a 5-inch screen.
      bodyLarge: _style(17, FontWeight.w400, _bodyHeight, onSurface),
      bodyMedium: _style(15, FontWeight.w400, _bodyHeight, onSurface),
      bodySmall: _style(13, FontWeight.w400, _bodyHeight, onSurface),

      labelLarge: _style(15, FontWeight.w600, 1.3, onSurface),
      labelMedium: _style(13, FontWeight.w500, 1.3, onSurface),
      labelSmall: _style(11, FontWeight.w500, 1.3, onSurface),
    );
  }

  static TextStyle _style(double size, FontWeight weight, double height, Color color) {
    return TextStyle(
      fontFamily: fontFamily,
      fontSize: size,
      fontWeight: weight,
      height: height,
      color: color,
    );
  }
}
