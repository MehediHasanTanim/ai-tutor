import 'package:flutter/material.dart';

/// Brand palette.
///
/// Built around a deep green — a colour with positive, non-partisan
/// associations in Bangladesh — with an amber accent for streaks and progress.
class AppColors {
  const AppColors._();

  static const Color seed = Color(0xFF00695C);

  static const Color primary = Color(0xFF00695C);
  static const Color primaryLight = Color(0xFF439889);
  static const Color primaryDark = Color(0xFF003D33);

  static const Color accent = Color(0xFFF9A825);

  static const Color success = Color(0xFF2E7D32);
  static const Color warning = Color(0xFFEF6C00);
  static const Color error = Color(0xFFC62828);
  static const Color info = Color(0xFF0277BD);

  /// Mastery bands, matching the recommendation thresholds in architecture §10
  /// so a colour on screen means the same thing as a rule on the server.
  static const Color masteryWeak = Color(0xFFC62828); // < 30
  static const Color masteryLearning = Color(0xFFEF6C00); // 30–60
  static const Color masteryGood = Color(0xFF558B2F); // 60–80
  static const Color masteryStrong = Color(0xFF2E7D32); // > 80

  static Color forMastery(double score) {
    if (score < 30) return masteryWeak;
    if (score < 60) return masteryLearning;
    if (score < 80) return masteryGood;
    return masteryStrong;
  }
}
