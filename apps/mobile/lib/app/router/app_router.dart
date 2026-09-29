import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/presentation/providers/auth_providers.dart';
import '../../features/auth/presentation/providers/auth_state.dart';
import '../../features/auth/presentation/screens/login_screen.dart';
import '../../features/auth/presentation/screens/register_screen.dart';
import '../../features/chapters/presentation/screens/chapter_detail_screen.dart';
import '../../features/home/presentation/screens/home_screen.dart';
import '../../features/onboarding/presentation/screens/academic_setup_screen.dart';
import '../../features/onboarding/presentation/screens/splash_screen.dart';
import '../../features/onboarding/presentation/screens/welcome_screen.dart';
import '../../features/profile/presentation/screens/profile_screen.dart';
import '../../features/progress/presentation/screens/progress_screen.dart';
import '../../features/quiz/presentation/screens/quiz_screen.dart';
import '../../features/subjects/presentation/screens/subjects_screen.dart';
import '../../features/tutor/presentation/screens/tutor_screen.dart';
import 'app_routes.dart';
import 'app_shell.dart';

final _rootNavigatorKey = GlobalKey<NavigatorState>();
final _shellNavigatorKey = GlobalKey<NavigatorState>();

final routerProvider = Provider<GoRouter>((ref) {
  // Watched, not read: the redirect below closes over this value, and
  // `refreshListenable` is what re-runs it when the value changes.
  final authNotifier = ValueNotifier<AuthState>(const AuthState());

  ref.listen(authControllerProvider, (previous, next) {
    authNotifier.value = next;
  }, fireImmediately: true);

  ref.onDispose(authNotifier.dispose);

  return GoRouter(
    navigatorKey: _rootNavigatorKey,
    initialLocation: AppRoutes.splash,
    debugLogDiagnostics: true,
    refreshListenable: authNotifier,
    redirect: (context, state) => _guard(authNotifier.value, state),
    routes: [
      GoRoute(
        path: AppRoutes.splash,
        name: RouteNames.splash,
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(
        path: AppRoutes.welcome,
        name: RouteNames.welcome,
        builder: (context, state) => const WelcomeScreen(),
      ),
      GoRoute(
        path: AppRoutes.login,
        name: RouteNames.login,
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: AppRoutes.register,
        name: RouteNames.register,
        builder: (context, state) => const RegisterScreen(),
      ),
      GoRoute(
        path: AppRoutes.onboarding,
        name: RouteNames.onboarding,
        builder: (context, state) => const AcademicSetupScreen(),
      ),

      // Full-screen routes that sit above the tab shell.
      GoRoute(
        path: AppRoutes.tutor,
        name: RouteNames.tutor,
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) => const TutorScreen(),
        routes: [
          GoRoute(
            path: ':sessionId',
            name: RouteNames.tutorSession,
            parentNavigatorKey: _rootNavigatorKey,
            builder: (context, state) => const TutorScreen(),
          ),
        ],
      ),
      GoRoute(
        path: '/chapters/:chapterId',
        name: RouteNames.chapterDetail,
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) => const ChapterDetailScreen(),
      ),

      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) => AppShell(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(
            navigatorKey: _shellNavigatorKey,
            routes: [
              GoRoute(
                path: AppRoutes.home,
                name: RouteNames.home,
                builder: (context, state) => const HomeScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.subjects,
                name: RouteNames.subjects,
                builder: (context, state) => const SubjectsScreen(),
                routes: [
                  GoRoute(
                    path: ':subjectId',
                    name: RouteNames.subjectDetail,
                    builder: (context, state) => const SubjectsScreen(),
                  ),
                ],
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.quiz,
                name: RouteNames.quiz,
                builder: (context, state) => const QuizScreen(),
                routes: [
                  GoRoute(
                    path: ':quizId',
                    name: RouteNames.quizDetail,
                    builder: (context, state) => const QuizScreen(),
                  ),
                ],
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.profile,
                name: RouteNames.profile,
                builder: (context, state) => const ProfileScreen(),
                routes: [
                  GoRoute(
                    path: 'progress',
                    name: RouteNames.progress,
                    builder: (context, state) => const ProgressScreen(),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    ],
    errorBuilder: (context, state) => _RouteErrorScreen(location: state.uri.toString()),
  );
});

/// The auth guard.
///
/// Three questions, in order:
///   1. Has the stored session been read yet? If not, hold on the splash.
///   2. Is the student signed in? If not, only the auth screens are reachable.
///   3. Has academic setup been done? If not, that is the only destination —
///      the tutor cannot scope retrieval without a class and subjects.
///
/// Returning null means "the requested location is fine".
String? _guard(AuthState auth, GoRouterState state) {
  final location = state.matchedLocation;

  const authScreens = {AppRoutes.welcome, AppRoutes.login, AppRoutes.register};
  final isOnSplash = location == AppRoutes.splash;
  final isOnAuthScreen = authScreens.contains(location);
  final isOnOnboarding = location == AppRoutes.onboarding;

  // 1. Still reading stored tokens.
  if (!auth.isResolved) {
    return isOnSplash ? null : AppRoutes.splash;
  }

  // 2. Signed out.
  if (!auth.isAuthenticated) {
    return isOnAuthScreen ? null : AppRoutes.welcome;
  }

  // 3. Signed in but setup is incomplete.
  if (auth.needsAcademicSetup) {
    return isOnOnboarding ? null : AppRoutes.onboarding;
  }

  // Signed in and set up: the auth screens and splash are no longer valid
  // destinations. Without this, the back button after login lands on the
  // login screen again.
  if (isOnSplash || isOnAuthScreen || isOnOnboarding) {
    return AppRoutes.home;
  }

  return null;
}

class _RouteErrorScreen extends StatelessWidget {
  const _RouteErrorScreen({required this.location});

  final String location;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.explore_off_rounded, size: 56, color: theme.colorScheme.error),
              const SizedBox(height: 20),
              Text('পাতাটি খুঁজে পাওয়া যায়নি', style: theme.textTheme.titleMedium),
              const SizedBox(height: 8),
              Text(
                location,
                textAlign: TextAlign.center,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 24),
              FilledButton(
                onPressed: () => context.go(AppRoutes.home),
                child: const Text('হোমে ফিরে যাও'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
