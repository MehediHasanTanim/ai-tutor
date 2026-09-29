/// Route paths and names — doc 05 §5.
///
/// Named constants rather than string literals at call sites, so a path change
/// is one edit and a typo is a compile error.
class AppRoutes {
  const AppRoutes._();

  static const String splash = '/splash';
  static const String welcome = '/welcome';
  static const String login = '/login';
  static const String register = '/register';
  static const String onboarding = '/onboarding';

  static const String home = '/home';
  static const String subjects = '/subjects';
  static const String tutor = '/tutor';
  static const String quiz = '/quiz';
  static const String progress = '/progress';
  static const String profile = '/profile';

  static String subjectDetail(String id) => '/subjects/$id';
  static String chapterDetail(String id) => '/chapters/$id';
  static String tutorSession(String id) => '/tutor/$id';
  static String quizDetail(String id) => '/quiz/$id';
}

class RouteNames {
  const RouteNames._();

  static const String splash = 'splash';
  static const String welcome = 'welcome';
  static const String login = 'login';
  static const String register = 'register';
  static const String onboarding = 'onboarding';
  static const String home = 'home';
  static const String subjects = 'subjects';
  static const String subjectDetail = 'subject-detail';
  static const String chapterDetail = 'chapter-detail';
  static const String tutor = 'tutor';
  static const String tutorSession = 'tutor-session';
  static const String quiz = 'quiz';
  static const String quizDetail = 'quiz-detail';
  static const String progress = 'progress';
  static const String profile = 'profile';
}
