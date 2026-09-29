import 'package:flutter/material.dart';

import '../../../../core/widgets/placeholder_screen.dart';

class TutorScreen extends StatelessWidget {
  const TutorScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const PlaceholderScreen(
      title: 'এআই টিউটর',
      icon: Icons.chat_bubble_rounded,
      plannedFor: 'Weeks 5–6',
    );
  }
}
