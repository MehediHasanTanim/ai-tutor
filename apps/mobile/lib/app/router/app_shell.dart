import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// The four-tab shell — doc 02 §4.
///
/// Home / Learn / Quiz / Profile, with the AI Tutor as a prominent primary
/// action rather than a fifth tab. The spec calls the tutor "a prominent
/// primary action", and a centre FAB gives it more weight than a tab of equal
/// size would.
class AppShell extends StatelessWidget {
  const AppShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: navigationShell,

      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _goToTutor(context),
        icon: const Icon(Icons.auto_awesome_rounded),
        label: const Text('প্রশ্ন করো'),
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.endFloat,

      bottomNavigationBar: NavigationBar(
        selectedIndex: navigationShell.currentIndex,
        onDestinationSelected: _onDestinationSelected,
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home_rounded),
            label: 'হোম',
          ),
          NavigationDestination(
            icon: Icon(Icons.menu_book_outlined),
            selectedIcon: Icon(Icons.menu_book_rounded),
            label: 'শেখো',
          ),
          NavigationDestination(
            icon: Icon(Icons.quiz_outlined),
            selectedIcon: Icon(Icons.quiz_rounded),
            label: 'কুইজ',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline_rounded),
            selectedIcon: Icon(Icons.person_rounded),
            label: 'প্রোফাইল',
          ),
        ],
      ),
    );
  }

  void _onDestinationSelected(int index) {
    navigationShell.goBranch(
      index,
      // Tapping the tab you are already on pops that branch back to its root,
      // which is the behaviour people expect from every other app.
      initialLocation: index == navigationShell.currentIndex,
    );
  }

  void _goToTutor(BuildContext context) => context.push(AppRoutesTutor.path);
}

/// Kept separate to avoid a circular import between the shell and the route
/// table that builds it.
class AppRoutesTutor {
  const AppRoutesTutor._();
  static const String path = '/tutor';
}
