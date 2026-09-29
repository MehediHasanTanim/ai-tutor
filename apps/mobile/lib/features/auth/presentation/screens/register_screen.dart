import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_theme.dart';
import '../../../../core/utils/validators.dart';
import '../../../../core/widgets/app_error_view.dart';
import '../providers/auth_providers.dart';

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  bool _obscurePassword = true;

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    FocusScope.of(context).unfocus();

    await ref
        .read(authControllerProvider.notifier)
        .register(
          name: _nameController.text.trim(),
          phone: Validators.normalizePhone(_phoneController.text),
          password: _passwordController.text,
          email: _emailController.text.trim(),
        );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final state = ref.watch(authControllerProvider);

    // Field-level errors from the server, keyed by field name — these are
    // more specific than anything the client can determine on its own.
    final serverFieldErrors = state.failure?.fieldErrors ?? const <String, List<String>>{};

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
                Text('অ্যাকাউন্ট খুলুন', style: theme.textTheme.displaySmall),
                const SizedBox(height: 8),
                Text(
                  'আপনার নিজের এআই টিউটর শুরু করুন',
                  style: theme.textTheme.bodyLarge?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 32),

                TextFormField(
                  controller: _nameController,
                  textCapitalization: TextCapitalization.words,
                  textInputAction: TextInputAction.next,
                  autofillHints: const [AutofillHints.name],
                  enabled: !state.isSubmitting,
                  decoration: InputDecoration(
                    labelText: 'আপনার নাম',
                    prefixIcon: const Icon(Icons.person_outline_rounded),
                    errorText: serverFieldErrors['name']?.first,
                  ),
                  validator: Validators.name,
                  onChanged: (_) => ref.read(authControllerProvider.notifier).clearFailure(),
                ),
                const SizedBox(height: 16),

                TextFormField(
                  controller: _phoneController,
                  keyboardType: TextInputType.phone,
                  textInputAction: TextInputAction.next,
                  autofillHints: const [AutofillHints.telephoneNumber],
                  enabled: !state.isSubmitting,
                  decoration: InputDecoration(
                    labelText: 'মোবাইল নম্বর',
                    hintText: '০১৭১২৩৪৫৬৭৮',
                    prefixIcon: const Icon(Icons.phone_outlined),
                    errorText: serverFieldErrors['phone']?.first,
                  ),
                  validator: Validators.phone,
                  onChanged: (_) => ref.read(authControllerProvider.notifier).clearFailure(),
                ),
                const SizedBox(height: 16),

                TextFormField(
                  controller: _emailController,
                  keyboardType: TextInputType.emailAddress,
                  textInputAction: TextInputAction.next,
                  autofillHints: const [AutofillHints.email],
                  enabled: !state.isSubmitting,
                  decoration: InputDecoration(
                    labelText: 'ইমেইল (ঐচ্ছিক)',
                    prefixIcon: const Icon(Icons.mail_outline_rounded),
                    errorText: serverFieldErrors['email']?.first,
                  ),
                  validator: Validators.optionalEmail,
                  onChanged: (_) => ref.read(authControllerProvider.notifier).clearFailure(),
                ),
                const SizedBox(height: 16),

                TextFormField(
                  controller: _passwordController,
                  obscureText: _obscurePassword,
                  textInputAction: TextInputAction.done,
                  autofillHints: const [AutofillHints.newPassword],
                  enabled: !state.isSubmitting,
                  decoration: InputDecoration(
                    labelText: 'পাসওয়ার্ড',
                    helperText: 'অন্তত ${Validators.minPasswordLength} অক্ষর',
                    prefixIcon: const Icon(Icons.lock_outline_rounded),
                    errorText: serverFieldErrors['password']?.first,
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
                  validator: Validators.password,
                  onFieldSubmitted: (_) => _submit(),
                  onChanged: (_) => ref.read(authControllerProvider.notifier).clearFailure(),
                ),

                // Only shown when the failure is not already attached to a
                // field, so the student never reads the same problem twice.
                if (state.failure != null && serverFieldErrors.isEmpty) ...[
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
                      : const Text('রেজিস্টার করুন'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
