import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_theme.dart';
import '../../../auth/presentation/providers/auth_providers.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final state = ref.watch(authControllerProvider);
    final user = state.user;

    return Scaffold(
      appBar: AppBar(title: const Text('প্রোফাইল')),
      body: SafeArea(
        child: ListView(
          padding: AppTheme.screenPadding,
          children: [
            Center(
              child: CircleAvatar(
                radius: 40,
                backgroundColor: theme.colorScheme.primaryContainer,
                child: Text(
                  _initials(user?.name),
                  style: theme.textTheme.headlineMedium?.copyWith(
                    color: theme.colorScheme.onPrimaryContainer,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              user?.name ?? '—',
              textAlign: TextAlign.center,
              style: theme.textTheme.titleLarge,
            ),
            Text(
              user?.phone ?? '',
              textAlign: TextAlign.center,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 32),

            if (state.profile case final profile?) ...[
              Card(
                child: Column(
                  children: [
                    _InfoTile(label: 'ক্লাস', value: 'ক্লাস ${profile.classLevel}'),
                    const Divider(height: 1),
                    _InfoTile(label: 'মাধ্যম', value: profile.medium.label),
                    const Divider(height: 1),
                    _InfoTile(
                      label: 'দৈনিক লক্ষ্য',
                      value: '${profile.dailyGoalMinutes} মিনিট',
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
            ],

            OutlinedButton.icon(
              onPressed: () => ref.read(authControllerProvider.notifier).logout(),
              icon: const Icon(Icons.logout_rounded),
              label: const Text('লগ আউট'),
              style: OutlinedButton.styleFrom(foregroundColor: theme.colorScheme.error),
            ),
          ],
        ),
      ),
    );
  }

  String _initials(String? name) {
    if (name == null || name.trim().isEmpty) return '?';
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.length == 1) return parts.first.characters.first.toUpperCase();
    return (parts.first.characters.first + parts.last.characters.first).toUpperCase();
  }
}

class _InfoTile extends StatelessWidget {
  const _InfoTile({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return ListTile(
      title: Text(label, style: theme.textTheme.bodyMedium),
      trailing: Text(value, style: theme.textTheme.titleSmall),
    );
  }
}
