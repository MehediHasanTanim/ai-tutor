import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_theme.dart';
import '../../../../core/constants/app_constants.dart';
import '../providers/academic_setup_state.dart';

/// Academic setup — doc 02 §4.
///
/// Collects class, curriculum, medium, subjects, target exam and daily study
/// time. Everything the tutor needs to scope retrieval to the right syllabus.
///
/// Submission is not wired yet: `PATCH /api/v1/me` arrives with the students
/// module in Weeks 3–4. The selections are held in `academicSetupProvider`, so
/// connecting it is a single call.
class AcademicSetupScreen extends ConsumerWidget {
  const AcademicSetupScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final setup = ref.watch(academicSetupProvider);
    final controller = ref.read(academicSetupProvider.notifier);

    return Scaffold(
      appBar: AppBar(title: const Text('তোমার পড়াশোনা')),
      body: SafeArea(
        child: ListView(
          padding: AppTheme.screenPadding,
          children: [
            Text(
              'কয়েকটা তথ্য দাও, যাতে তোমার জন্য ঠিক সিলেবাসের উত্তর দিতে পারি।',
              style: theme.textTheme.bodyLarge?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 28),

            _Section(
              title: 'তুমি কোন ক্লাসে পড়ো?',
              child: Row(
                children: [
                  for (final level in AppConstants.supportedClassLevels) ...[
                    Expanded(
                      child: _ChoiceCard(
                        label: 'ক্লাস $level',
                        selected: setup.classLevel == level,
                        onTap: () => controller.setClassLevel(level),
                      ),
                    ),
                    if (level != AppConstants.supportedClassLevels.last)
                      const SizedBox(width: 12),
                  ],
                ],
              ),
            ),

            _Section(
              title: 'সিলেবাস',
              // NCTB only for the MVP (D-02). Shown rather than hidden so the
              // scope is visible, disabled because there is nothing to choose.
              child: _ChoiceCard(
                label: 'এনসিটিবি জাতীয় শিক্ষাক্রম',
                selected: true,
                enabled: false,
                onTap: () {},
              ),
            ),

            _Section(
              title: 'মাধ্যম',
              child: Wrap(
                spacing: 10,
                runSpacing: 10,
                children: [
                  for (final medium in Medium.values)
                    ChoiceChip(
                      label: Text(medium.label),
                      selected: setup.medium == medium,
                      onSelected: (_) => controller.setMedium(medium),
                    ),
                ],
              ),
            ),

            _Section(
              title: 'কোন বিষয়গুলো পড়ছো?',
              subtitle: 'একাধিক বেছে নিতে পারো',
              child: Wrap(
                spacing: 10,
                runSpacing: 10,
                children: [
                  for (final subject in mvpSubjects)
                    FilterChip(
                      label: Text(subject.nameBn),
                      selected: setup.subjectCodes.contains(subject.code),
                      onSelected: (_) => controller.toggleSubject(subject.code),
                    ),
                ],
              ),
            ),

            _Section(
              title: 'লক্ষ্য পরীক্ষা',
              child: Wrap(
                spacing: 10,
                runSpacing: 10,
                children: [
                  for (final exam in const ['SSC', 'স্কুল পরীক্ষা'])
                    ChoiceChip(
                      label: Text(exam),
                      selected: setup.targetExam == exam,
                      onSelected: (selected) =>
                          controller.setTargetExam(selected ? exam : null),
                    ),
                ],
              ),
            ),

            _Section(
              title: 'প্রতিদিন কতক্ষণ পড়তে চাও?',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    '${setup.dailyGoalMinutes} মিনিট',
                    textAlign: TextAlign.center,
                    style: theme.textTheme.headlineSmall?.copyWith(
                      color: theme.colorScheme.primary,
                    ),
                  ),
                  Slider(
                    value: setup.dailyGoalMinutes.toDouble(),
                    min: AppConstants.minDailyGoalMinutes.toDouble(),
                    max: AppConstants.maxDailyGoalMinutes.toDouble(),
                    divisions:
                        (AppConstants.maxDailyGoalMinutes - AppConstants.minDailyGoalMinutes) ~/
                        15,
                    label: '${setup.dailyGoalMinutes} মিনিট',
                    onChanged: (value) => controller.setDailyGoal(value.round()),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 12),
            FilledButton(
              onPressed: setup.isComplete ? () => _submit(context) : null,
              child: const Text('শুরু করি'),
            ),
            if (!setup.isComplete) ...[
              const SizedBox(height: 12),
              Text(
                'ক্লাস আর অন্তত একটি বিষয় বেছে নাও',
                textAlign: TextAlign.center,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ],
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  void _submit(BuildContext context) {
    // TODO(weeks-3-4): PATCH /api/v1/me with the collected setup, then let the
    // router redirect on the profile appearing in AuthState.
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('সেটআপ সংরক্ষণ হবে — API যুক্ত হচ্ছে (Weeks 3–4)'),
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.child, this.subtitle});

  final String title;
  final String? subtitle;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.only(bottom: 28),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: theme.textTheme.titleMedium),
          if (subtitle != null) ...[
            const SizedBox(height: 2),
            Text(
              subtitle!,
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
          ],
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }
}

class _ChoiceCard extends StatelessWidget {
  const _ChoiceCard({
    required this.label,
    required this.selected,
    required this.onTap,
    this.enabled = true,
  });

  final String label;
  final bool selected;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return InkWell(
      onTap: enabled ? onTap : null,
      borderRadius: BorderRadius.circular(AppTheme.radiusMedium),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
        decoration: BoxDecoration(
          color: selected ? theme.colorScheme.primaryContainer : theme.colorScheme.surface,
          borderRadius: BorderRadius.circular(AppTheme.radiusMedium),
          border: Border.all(
            color: selected ? theme.colorScheme.primary : theme.colorScheme.outlineVariant,
            width: selected ? 2 : 1,
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (selected) ...[
              Icon(Icons.check_circle_rounded, size: 20, color: theme.colorScheme.primary),
              const SizedBox(width: 8),
            ],
            Flexible(
              child: Text(
                label,
                textAlign: TextAlign.center,
                style: theme.textTheme.titleSmall?.copyWith(
                  color: selected
                      ? theme.colorScheme.onPrimaryContainer
                      : theme.colorScheme.onSurface,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
