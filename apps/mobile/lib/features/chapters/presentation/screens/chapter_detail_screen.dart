import 'package:flutter/material.dart';

import '../../../../core/widgets/placeholder_screen.dart';

class ChapterDetailScreen extends StatelessWidget {
  const ChapterDetailScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const PlaceholderScreen(
      title: 'অধ্যায়',
      icon: Icons.article_rounded,
      plannedFor: 'Weeks 3–4',
    );
  }
}
