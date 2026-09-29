import 'package:ai_tutor/app/theme/app_theme.dart';
import 'package:ai_tutor/app/theme/app_typography.dart';
import 'package:ai_tutor/core/errors/error_codes.dart';
import 'package:ai_tutor/core/errors/failure.dart';
import 'package:ai_tutor/core/widgets/app_error_view.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

Widget _wrap(Widget child, {Brightness brightness = Brightness.light}) => MaterialApp(
  theme: brightness == Brightness.light ? AppTheme.light : AppTheme.dark,
  home: Scaffold(body: child),
);

void main() {
  group('theme', () {
    test('both brightnesses use the bundled Bangla family', () {
      for (final theme in [AppTheme.light, AppTheme.dark]) {
        expect(theme.textTheme.bodyLarge?.fontFamily, AppTypography.fontFamily);
        expect(theme.textTheme.displayLarge?.fontFamily, AppTypography.fontFamily);
      }
    });

    test('body text sets an explicit line height', () {
      // Material's default clips Bangla conjunct descenders.
      expect(AppTheme.light.textTheme.bodyLarge?.height, greaterThan(1.4));
    });

    test('body text is a step larger than the Material default', () {
      expect(AppTheme.light.textTheme.bodyLarge?.fontSize, greaterThanOrEqualTo(16));
    });

    test('error text is allowed to wrap', () {
      // Bangla error strings run long; one line would truncate them.
      expect(AppTheme.light.inputDecorationTheme.errorMaxLines, greaterThan(1));
    });

    test('dark theme is actually dark', () {
      expect(AppTheme.dark.brightness, Brightness.dark);
      expect(AppTheme.light.brightness, Brightness.light);
    });
  });

  group('AppErrorView', () {
    testWidgets('shows the Bangla message, not the English one', (tester) async {
      await tester.pumpWidget(
        _wrap(
          const AppErrorView(
            failure: Failure(
              code: ApiErrorCode.quotaExceeded,
              message: 'Daily question limit reached',
              messageBn: 'আজকের প্রশ্নের সীমা শেষ হয়েছে',
            ),
          ),
        ),
      );

      expect(find.text('আজকের প্রশ্নের সীমা শেষ হয়েছে'), findsOneWidget);
      expect(find.text('Daily question limit reached'), findsNothing);
    });

    testWidgets('offers retry only when retrying could help', (tester) async {
      await tester.pumpWidget(_wrap(AppErrorView(failure: Failure.network, onRetry: () {})));
      expect(find.text('আবার চেষ্টা করুন'), findsOneWidget);

      await tester.pumpWidget(
        _wrap(
          AppErrorView(
            failure: const Failure(
              code: ApiErrorCode.invalidCredentials,
              message: 'Invalid credentials',
              messageBn: 'ভুল তথ্য',
            ),
            onRetry: () {},
          ),
        ),
      );
      expect(find.text('আবার চেষ্টা করুন'), findsNothing);
    });

    testWidgets('surfaces the request id for support', (tester) async {
      await tester.pumpWidget(
        _wrap(
          const AppErrorView(
            failure: Failure(
              code: ApiErrorCode.internalError,
              message: 'boom',
              messageBn: 'সমস্যা',
              requestId: 'req_abc123',
            ),
          ),
        ),
      );

      expect(find.text('req_abc123'), findsOneWidget);
    });
  });

  group('AppInlineError', () {
    testWidgets('renders in both themes without overflowing', (tester) async {
      for (final brightness in Brightness.values) {
        await tester.pumpWidget(
          _wrap(
            const AppInlineError(
              failure: Failure(
                code: ApiErrorCode.invalidCredentials,
                message: 'Invalid credentials',
                messageBn: 'ভুল তথ্য দিয়েছেন, আবার চেষ্টা করুন',
              ),
            ),
            brightness: brightness,
          ),
        );
        await tester.pumpAndSettle();

        expect(tester.takeException(), isNull);
        expect(find.text('ভুল তথ্য দিয়েছেন, আবার চেষ্টা করুন'), findsOneWidget);
      }
    });
  });
}
