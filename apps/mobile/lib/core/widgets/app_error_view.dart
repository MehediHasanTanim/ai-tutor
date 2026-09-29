import 'package:flutter/material.dart';

import '../errors/failure.dart';
import '../../app/theme/app_theme.dart';

/// The single way a [Failure] is shown full-screen.
///
/// Doc 07 Weeks 13–14 requires that no screen can reach a dead end with no
/// message and no way back. Routing every error through one widget is how that
/// stays true as screens get added, rather than being audited at the end.
class AppErrorView extends StatelessWidget {
  const AppErrorView({super.key, required this.failure, this.onRetry});

  final Failure failure;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(_icon, size: 56, color: theme.colorScheme.error),
            const SizedBox(height: 20),
            Text(
              failure.displayMessage,
              textAlign: TextAlign.center,
              style: theme.textTheme.bodyLarge,
            ),
            if (onRetry != null && failure.isRetryable) ...[
              const SizedBox(height: 24),
              FilledButton.tonal(
                onPressed: onRetry,
                child: const Text('আবার চেষ্টা করুন'),
              ),
            ],
            if (failure.requestId != null) ...[
              const SizedBox(height: 16),
              // Surfaced so a student reporting a problem can quote it and
              // someone can find the exact server log line.
              Text(
                failure.requestId!,
                style: theme.textTheme.labelSmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  IconData get _icon => switch (failure.code) {
    _ when failure.code.isRetryable => Icons.wifi_off_rounded,
    _ => Icons.error_outline_rounded,
  };
}

/// Inline error for forms — sits above the submit button.
class AppInlineError extends StatelessWidget {
  const AppInlineError({super.key, required this.failure});

  final Failure failure;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: theme.colorScheme.errorContainer,
        borderRadius: BorderRadius.circular(AppTheme.radiusMedium),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.error_outline_rounded, size: 20, color: theme.colorScheme.onErrorContainer),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              failure.displayMessage,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onErrorContainer,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
