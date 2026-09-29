import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app/app.dart';
import 'core/providers/core_providers.dart';
import 'core/storage/preferences_storage.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Portrait only for now. The tutor and quiz layouts are designed for it,
  // and landscape is not something this audience uses for study.
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  // Resolved before the first frame so screens can read preferences
  // synchronously rather than each awaiting a future.
  final preferences = await PreferencesStorage.create();

  runApp(
    ProviderScope(
      overrides: [preferencesStorageProvider.overrideWithValue(preferences)],
      child: const AiTutorApp(),
    ),
  );
}
