import 'package:flutter/material.dart';

import '../../../../core/widgets/placeholder_screen.dart';

class QuizScreen extends StatelessWidget {
  const QuizScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const PlaceholderScreen(
      title: 'কুইজ',
      icon: Icons.quiz_rounded,
      plannedFor: 'Weeks 9–10',
    );
  }
}
