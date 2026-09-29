/// Product-level constants.
class AppConstants {
  const AppConstants._();

  static const String appName = 'AI Tutor';
  static const String appNameBn = 'এআই টিউটর';

  /// MVP scope — doc 07 D-02.
  static const List<int> supportedClassLevels = [9, 10];

  static const int minDailyGoalMinutes = 15;
  static const int maxDailyGoalMinutes = 240;
  static const int defaultDailyGoalMinutes = 30;
}

/// Tutor interaction language. Mirrors `Language` in `@ai-tutor/shared-types`.
enum AppLanguage {
  bangla('bn', 'বাংলা'),
  english('en', 'English'),

  /// Romanized Bangla. A first-class input mode, not a fallback — doc 02 §2.
  banglish('banglish', 'Banglish');

  const AppLanguage(this.code, this.label);

  final String code;
  final String label;

  static AppLanguage fromCode(String code) => AppLanguage.values.firstWhere(
    (language) => language.code == code,
    orElse: () => AppLanguage.bangla,
  );
}

/// Instruction medium. Mirrors the `Medium` enum in shared-types.
enum Medium {
  bangla('BANGLA', 'বাংলা মাধ্যম'),
  english('ENGLISH', 'English Medium'),
  englishVersion('ENGLISH_VERSION', 'English Version');

  const Medium(this.code, this.label);

  final String code;
  final String label;

  static Medium fromCode(String code) => Medium.values.firstWhere(
    (medium) => medium.code == code,
    orElse: () => Medium.bangla,
  );
}
