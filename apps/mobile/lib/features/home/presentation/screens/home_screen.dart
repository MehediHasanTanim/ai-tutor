import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_theme.dart';
import '../../../auth/presentation/providers/auth_providers.dart';

/// Home tab — doc 02 §5.
///
/// The real content (today's progress, daily goal, streak, continue learning,
/// weak topics, recommendations) needs the progress and recommendations
/// modules, which arrive in Weeks 11–12. What is here now is the shell and
/// the greeting, so the tab is not empty during development.
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final user = ref.watch(authControllerProvider).user;

    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: AppTheme.screenPadding,
          children: [
            Text(
              'আসসালামু আলাইকুম',
              style: theme.textTheme.bodyLarge?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 4),
            Text(user?.name ?? 'শিক্ষার্থী', style: theme.textTheme.displaySmall),
            const SizedBox(height: 28),

            const _ComingSoonCard(
              icon: Icons.track_changes_rounded,
              title: 'আজকের লক্ষ্য',
              note: 'Weeks 11–12',
            ),
            const SizedBox(height: 12),
            const _ComingSoonCard(
              icon: Icons.local_fire_department_rounded,
              title: 'ধারাবাহিকতা',
              note: 'Weeks 11–12',
            ),
            const SizedBox(height: 12),
            const _ComingSoonCard(
              icon: Icons.warning_amber_rounded,
              title: 'দুর্বল টপিক',
              note: 'Weeks 11–12',
            ),
          ],
        ),
      ),
    );
  }
}

class _ComingSoonCard extends StatelessWidget {
  const _ComingSoonCard({required this.icon, required this.title, required this.note});

  final IconData icon;
  final String title;
  final String note;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Card(
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        leading: Icon(icon, color: theme.colorScheme.primary),
        title: Text(title, style: theme.textTheme.titleSmall),
        subtitle: Text(
          note,
          style: theme.textTheme.bodySmall?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
        ),
      ),
    );
  }
}
