import 'package:flutter/material.dart';

import '../../../../core/widgets/placeholder_screen.dart';

class SubjectsScreen extends StatelessWidget {
  const SubjectsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const PlaceholderScreen(
      title: 'শেখো',
      icon: Icons.menu_book_rounded,
      plannedFor: 'Weeks 3–4',
    );
  }
}
