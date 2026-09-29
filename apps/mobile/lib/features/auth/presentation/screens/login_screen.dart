import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/app_routes.dart';
import '../../../../app/theme/app_theme.dart';
import '../../../../core/utils/validators.dart';
import '../../../../core/widgets/app_error_view.dart';
import '../providers/auth_providers.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _identifierController = TextEditingController();
  final _passwordController = TextEditingController();

  bool _obscurePassword = true;

  @override
  void dispose() {
    _identifierController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    FocusScope.of(context).unfocus();

    await ref
        .read(authControllerProvider.notifier)
        .login(
          identifier: Validators.normalizeIdentifier(_identifierController.text),
          password: _passwordController.text,
        );

    // The router redirects on success; nothing to do here. Failure is rendered
    // from state below.
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final state = ref.watch(authControllerProvider);

    return Scaffold(
      appBar: AppBar(),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: AppTheme.screenPadding,
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('আবার স্বাগতম', style: theme.textTheme.displaySmall),
                const SizedBox(height: 8),
                Text(
                  'পড়া চালিয়ে যেতে লগইন করুন',
                  style: theme.textTheme.bodyLarge?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 32),

                TextFormField(
                  controller: _identifierController,
                  keyboardType: TextInputType.text,
                  textInputAction: TextInputAction.next,
                  autofillHints: const [AutofillHints.username],
                  enabled: !state.isSubmitting,
                  decoration: const InputDecoration(
                    labelText: 'মোবাইল নম্বর বা ইমেইল',
                    hintText: '০১৭১২৩৪৫৬৭৮',
                    prefixIcon: Icon(Icons.person_outline_rounded),
                  ),
                  validator: Validators.loginIdentifier,
                  onChanged: (_) => ref.read(authControllerProvider.notifier).clearFailure(),
                ),
                const SizedBox(height: 16),

                TextFormField(
                  controller: _passwordController,
                  obscureText: _obscurePassword,
                  textInputAction: TextInputAction.done,
                  autofillHints: const [AutofillHints.password],
                  enabled: !state.isSubmitting,
                  decoration: InputDecoration(
                    labelText: 'পাসওয়ার্ড',
                    prefixIcon: const Icon(Icons.lock_outline_rounded),
                    suffixIcon: IconButton(
                      icon: Icon(
                        _obscurePassword
                            ? Icons.visibility_outlined
                            : Icons.visibility_off_outlined,
                      ),
                      tooltip: _obscurePassword ? 'পাসওয়ার্ড দেখুন' : 'পাসওয়ার্ড লুকান',
                      onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                    ),
                  ),
                  validator: (value) => (value ?? '').isEmpty ? 'পাসওয়ার্ড দিন' : null,
                  onFieldSubmitted: (_) => _submit(),
                  onChanged: (_) => ref.read(authControllerProvider.notifier).clearFailure(),
                ),

                if (state.failure != null) ...[
                  const SizedBox(height: 20),
                  AppInlineError(failure: state.failure!),
                ],

                const SizedBox(height: 28),
                FilledButton(
                  onPressed: state.isSubmitting ? null : _submit,
                  child: state.isSubmitting
                      ? const SizedBox(
                          height: 22,
                          width: 22,
                          child: CircularProgressIndicator(strokeWidth: 2.5),
                        )
                      : const Text('লগইন করুন'),
                ),

                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text('অ্যাকাউন্ট নেই?', style: theme.textTheme.bodyMedium),
                    TextButton(
                      onPressed: state.isSubmitting
                          ? null
                          : () => context.push(AppRoutes.register),
                      child: const Text('রেজিস্টার করুন'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
