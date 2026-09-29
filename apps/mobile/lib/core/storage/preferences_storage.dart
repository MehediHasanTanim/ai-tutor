import 'package:shared_preferences/shared_preferences.dart';

/// Non-sensitive local preferences — theme, language, onboarding state.
///
/// Deliberately separate from [TokenStorage]: mixing preferences and
/// credentials in one store is how a "clear cache" ends up logging someone out,
/// or worse, how a credential ends up somewhere unencrypted.
class PreferencesStorage {
  PreferencesStorage(this._prefs);

  final SharedPreferences _prefs;

  static Future<PreferencesStorage> create() async =>
      PreferencesStorage(await SharedPreferences.getInstance());

  static const String _themeModeKey = 'pref.theme_mode';
  static const String _languageKey = 'pref.language';
  static const String _onboardingCompleteKey = 'pref.onboarding_complete';

  String? get themeMode => _prefs.getString(_themeModeKey);
  Future<void> setThemeMode(String value) => _prefs.setString(_themeModeKey, value);

  String? get language => _prefs.getString(_languageKey);
  Future<void> setLanguage(String value) => _prefs.setString(_languageKey, value);

  bool get onboardingComplete => _prefs.getBool(_onboardingCompleteKey) ?? false;
  Future<void> setOnboardingComplete(bool value) =>
      _prefs.setBool(_onboardingCompleteKey, value);

  Future<void> clear() => _prefs.clear();
}
