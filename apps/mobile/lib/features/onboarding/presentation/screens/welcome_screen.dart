import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/app_routes.dart';
import '../../../../app/theme/app_theme.dart';
import '../../../../core/constants/app_constants.dart';

class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: AppTheme.screenPadding,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Spacer(flex: 2),

              Icon(Icons.school_rounded, size: 80, color: theme.colorScheme.primary),
              const SizedBox(height: 28),

              Text(
                AppConstants.appNameBn,
                textAlign: TextAlign.center,
                style: theme.textTheme.displayMedium,
              ),
              const SizedBox(height: 12),
              Text(
                'তোমার নিজের এআই শিক্ষক —\nযে তোমার সিলেবাস বোঝে',
                textAlign: TextAlign.center,
                style: theme.textTheme.bodyLarge?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),

              const Spacer(),

              const _FeatureRow(
                icon: Icons.chat_bubble_outline_rounded,
                text: 'বাংলা, English বা Banglish-এ প্রশ্ন করো',
              ),
              const SizedBox(height: 16),
              const _FeatureRow(
                icon: Icons.camera_alt_outlined,
                text: 'বইয়ের ছবি তুলে ধাপে ধাপে সমাধান পাও',
              ),
              const SizedBox(height: 16),
              const _FeatureRow(
                icon: Icons.insights_outlined,
                text: 'কুইজ দিয়ে দুর্বল টপিক খুঁজে বের করো',
              ),

              const Spacer(flex: 2),

              FilledButton(
                onPressed: () => context.push(AppRoutes.register),
                child: const Text('শুরু করি'),
              ),
              const SizedBox(height: 12),
              OutlinedButton(
                onPressed: () => context.push(AppRoutes.login),
                child: const Text('আমার অ্যাকাউন্ট আছে'),
              ),
              const SizedBox(height: 8),
            ],
          ),
        ),
      ),
    );
  }
}

class _FeatureRow extends StatelessWidget {
  const _FeatureRow({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Row(
      children: [
        Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: theme.colorScheme.primaryContainer,
            borderRadius: BorderRadius.circular(AppTheme.radiusMedium),
          ),
          child: Icon(icon, size: 22, color: theme.colorScheme.onPrimaryContainer),
        ),
        const SizedBox(width: 16),
        Expanded(child: Text(text, style: theme.textTheme.bodyMedium)),
      ],
    );
  }
}
