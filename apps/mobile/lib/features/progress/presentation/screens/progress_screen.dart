import 'package:flutter/material.dart';

import '../../../../core/widgets/placeholder_screen.dart';

class ProgressScreen extends StatelessWidget {
  const ProgressScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const PlaceholderScreen(
      title: 'অগ্রগতি',
      icon: Icons.insights_rounded,
      plannedFor: 'Weeks 11–12',
    );
  }
}
