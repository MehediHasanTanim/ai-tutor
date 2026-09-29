/// Form validation.
///
/// These mirror the server's DTO rules so a student gets feedback without a
/// round trip. The server remains the authority — client validation here is a
/// convenience, never the enforcement point.
class Validators {
  const Validators._();

  /// Operator prefixes 013–019, eleven digits total.
  static final RegExp _bdPhoneLocal = RegExp(r'^01[3-9]\d{8}$');
  static final RegExp _bdPhoneE164 = RegExp(r'^\+8801[3-9]\d{8}$');
  static final RegExp _email = RegExp(r'^[\w.+-]+@[\w-]+\.[\w.-]+$');

  static const int minPasswordLength = 8;
  static const int maxPasswordLength = 128;

  /// Normalizes what students actually type into E.164.
  ///
  /// Mirrors `normalizeBdPhone` in `apps/api`. Sending the server a
  /// pre-normalized number means the two agree on what counts as a duplicate.
  static String normalizePhone(String input) {
    final digits = input.replaceAll(RegExp(r'[\s()\-]'), '');

    if (_bdPhoneLocal.hasMatch(digits)) return '+880${digits.substring(1)}';
    if (RegExp(r'^8801[3-9]\d{8}$').hasMatch(digits)) return '+$digits';
    return digits;
  }

  static String? phone(String? value) {
    final input = value?.trim() ?? '';
    if (input.isEmpty) return 'মোবাইল নম্বর দিন';

    final normalized = normalizePhone(input);
    if (!_bdPhoneE164.hasMatch(normalized)) {
      return 'সঠিক মোবাইল নম্বর দিন (যেমন ০১৭১২৩৪৫৬৭৮)';
    }
    return null;
  }

  static String? name(String? value) {
    final input = value?.trim() ?? '';
    if (input.isEmpty) return 'আপনার নাম দিন';
    if (input.length < 2) return 'নামটি অন্তত ২ অক্ষরের হতে হবে';
    if (input.length > 120) return 'নামটি অনেক বড়';
    return null;
  }

  /// Optional field — an empty value is valid.
  static String? optionalEmail(String? value) {
    final input = value?.trim() ?? '';
    if (input.isEmpty) return null;
    if (!_email.hasMatch(input)) return 'সঠিক ইমেইল ঠিকানা দিন';
    return null;
  }

  static String? password(String? value) {
    final input = value ?? '';
    if (input.isEmpty) return 'পাসওয়ার্ড দিন';
    if (input.length < minPasswordLength) {
      return 'পাসওয়ার্ড অন্তত $minPasswordLength অক্ষরের হতে হবে';
    }
    if (input.length > maxPasswordLength) return 'পাসওয়ার্ডটি অনেক বড়';
    return null;
  }

  /// Login accepts either identifier, so this only checks it is one of them.
  static String? loginIdentifier(String? value) {
    final input = value?.trim() ?? '';
    if (input.isEmpty) return 'মোবাইল নম্বর বা ইমেইল দিন';

    if (input.contains('@')) {
      return _email.hasMatch(input) ? null : 'সঠিক ইমেইল ঠিকানা দিন';
    }
    return _bdPhoneE164.hasMatch(normalizePhone(input))
        ? null
        : 'সঠিক মোবাইল নম্বর বা ইমেইল দিন';
  }

  /// Login sends whichever form the student used, normalized if it is a phone.
  static String normalizeIdentifier(String input) {
    final trimmed = input.trim();
    if (trimmed.contains('@')) return trimmed.toLowerCase();
    return normalizePhone(trimmed);
  }
}
