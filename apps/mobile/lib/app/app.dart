import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/constants/app_constants.dart';
import 'router/app_router.dart';
import 'theme/app_theme.dart';

class AiTutorApp extends ConsumerWidget {
  const AiTutorApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp.router(
      title: AppConstants.appName,
      debugShowCheckedModeBanner: false,

      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      themeMode: ThemeMode.system,

      routerConfig: ref.watch(routerProvider),

      // Bangla-first, with English available — doc 05 §11.
      locale: const Locale('bn'),
      supportedLocales: const [Locale('bn'), Locale('en')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],

      builder: (context, child) {
        // Honour the OS font-size setting, but stop at 1.4×. Beyond that the
        // quiz and tutor layouts break, and a broken layout helps nobody who
        // needed the larger text in the first place.
        final mediaQuery = MediaQuery.of(context);
        return MediaQuery(
          data: mediaQuery.copyWith(
            textScaler: mediaQuery.textScaler.clamp(minScaleFactor: 1.0, maxScaleFactor: 1.4),
          ),
          child: child ?? const SizedBox.shrink(),
        );
      },
    );
  }
}
