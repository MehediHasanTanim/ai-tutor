import 'package:flutter/material.dart';

import '../../../../core/constants/app_constants.dart';

/// Shown while stored tokens are read on cold start.
///
/// The router holds here until `AuthState` resolves out of `unknown`, which is
/// what prevents the login screen flashing before a signed-in student's home
/// screen.
class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.school_rounded, size: 72, color: theme.colorScheme.primary),
            const SizedBox(height: 20),
            Text(AppConstants.appNameBn, style: theme.textTheme.displaySmall),
            const SizedBox(height: 40),
            const SizedBox(
              height: 28,
              width: 28,
              child: CircularProgressIndicator(strokeWidth: 3),
            ),
          ],
        ),
      ),
    );
  }
}
