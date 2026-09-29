import 'package:ai_tutor/core/utils/validators.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('normalizePhone', () {
    test('converts the local form students actually type to E.164', () {
      expect(Validators.normalizePhone('01712345678'), '+8801712345678');
      expect(Validators.normalizePhone('8801712345678'), '+8801712345678');
      expect(Validators.normalizePhone('+8801712345678'), '+8801712345678');
    });

    test('tolerates separators', () {
      expect(Validators.normalizePhone('01712-345678'), '+8801712345678');
      expect(Validators.normalizePhone('017 1234 5678'), '+8801712345678');
      expect(Validators.normalizePhone('(017)12345678'), '+8801712345678');
    });

    test('matches the server so both agree on what is a duplicate', () {
      // apps/api normalizeBdPhone produces exactly these. If this test starts
      // failing, one side has drifted.
      const cases = {
        '01312345678': '+8801312345678',
        '01912345678': '+8801912345678',
        '01512345678': '+8801512345678',
      };
      cases.forEach((input, expected) {
        expect(Validators.normalizePhone(input), expected);
      });
    });

    test('leaves an unrecognised number alone for the validator to reject', () {
      // 012 is not a live operator prefix.
      expect(Validators.normalizePhone('01212345678'), '01212345678');
      expect(Validators.normalizePhone('+14155551234'), '+14155551234');
    });
  });

  group('phone', () {
    test('accepts every live operator prefix', () {
      for (final prefix in ['013', '014', '015', '016', '017', '018', '019']) {
        expect(Validators.phone('${prefix}12345678'), isNull, reason: prefix);
      }
    });

    test('rejects empty, short, and dead-prefix numbers', () {
      expect(Validators.phone(''), isNotNull);
      expect(Validators.phone('0171234567'), isNotNull);
      expect(Validators.phone('01212345678'), isNotNull);
      expect(Validators.phone('not a phone'), isNotNull);
    });

    test('returns a Bangla message', () {
      // Error text goes straight to a student, so it must not be English.
      expect(Validators.phone(''), matches(RegExp(r'[ঀ-৿]')));
    });
  });

  group('password', () {
    test('enforces the same 8-128 bound as the server DTO', () {
      expect(Validators.password('short'), isNotNull);
      expect(Validators.password('a' * 8), isNull);
      expect(Validators.password('a' * 128), isNull);
      expect(Validators.password('a' * 129), isNotNull);
    });
  });

  group('optionalEmail', () {
    test('treats empty as valid, since the field is optional', () {
      expect(Validators.optionalEmail(''), isNull);
      expect(Validators.optionalEmail('   '), isNull);
      expect(Validators.optionalEmail(null), isNull);
    });

    test('validates a supplied address', () {
      expect(Validators.optionalEmail('student@example.com'), isNull);
      expect(Validators.optionalEmail('not-an-email'), isNotNull);
    });
  });

  group('loginIdentifier', () {
    test('accepts either a phone or an email', () {
      expect(Validators.loginIdentifier('01712345678'), isNull);
      expect(Validators.loginIdentifier('student@example.com'), isNull);
    });

    test('rejects neither', () {
      expect(Validators.loginIdentifier(''), isNotNull);
      expect(Validators.loginIdentifier('12345'), isNotNull);
    });
  });

  group('normalizeIdentifier', () {
    test('lowercases an email and normalizes a phone', () {
      expect(Validators.normalizeIdentifier('  Rafi@Example.COM '), 'rafi@example.com');
      expect(Validators.normalizeIdentifier(' 01712345678 '), '+8801712345678');
    });
  });
}
