import 'package:flutter/material.dart';

/// Stands in for a screen that a later week builds.
///
/// Named for what it is. A screen that looks half-finished is easy to mistake
/// for a bug; one that says which week it arrives in is not.
class PlaceholderScreen extends StatelessWidget {
  const PlaceholderScreen({
    super.key,
    required this.title,
    required this.icon,
    required this.plannedFor,
  });

  final String title;
  final IconData icon;

  /// e.g. 'Weeks 5–6'.
  final String plannedFor;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 64, color: theme.colorScheme.primary.withValues(alpha: 0.4)),
              const SizedBox(height: 20),
              Text(title, style: theme.textTheme.titleLarge),
              const SizedBox(height: 8),
              Text(
                'Planned for $plannedFor',
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
