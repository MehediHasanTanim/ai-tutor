/// API surface constants.
///
/// Paths mirror `apps/api` — doc 04, plus the additions in doc 07 Appendix C.
/// Keeping them in one place means a route rename is a single edit rather than
/// a grep through datasources.
class ApiPaths {
  const ApiPaths._();

  // Auth
  static const String register = '/auth/register';
  static const String login = '/auth/login';
  static const String refresh = '/auth/refresh';
  static const String logout = '/auth/logout';

  // Student
  static const String me = '/me';
  static const String myProgress = '/me/progress';
  static const String myRecommendations = '/me/recommendations';
  static const String myUsage = '/me/usage';

  // Curriculum
  static const String curriculum = '/curriculum';
  static const String subjects = '/subjects';
  static String subjectChapters(String id) => '/subjects/$id/chapters';
  static String chapterTopics(String id) => '/chapters/$id/topics';
}

/// Header names shared with the backend.
class ApiHeaders {
  const ApiHeaders._();

  static const String requestId = 'x-request-id';
  static const String authorization = 'Authorization';
}

class ApiTimeouts {
  const ApiTimeouts._();

  static const Duration connect = Duration(seconds: 15);

  /// Generous by web standards, deliberately. This app is used on mobile data
  /// in places where a 2G fallback is normal.
  static const Duration receive = Duration(seconds: 30);
  static const Duration send = Duration(seconds: 30);
}
