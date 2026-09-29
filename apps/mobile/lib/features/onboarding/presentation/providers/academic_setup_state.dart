import 'package:equatable/equatable.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/constants/app_constants.dart';

/// What academic setup collects — doc 02 §4.
class AcademicSetup extends Equatable {
  const AcademicSetup({
    this.classLevel,
    this.curriculum = 'nctb',
    this.medium = Medium.bangla,
    this.subjectCodes = const {},
    this.targetExam,
    this.dailyGoalMinutes = AppConstants.defaultDailyGoalMinutes,
  });

  final int? classLevel;
  final String curriculum;
  final Medium medium;
  final Set<String> subjectCodes;
  final String? targetExam;
  final int dailyGoalMinutes;

  /// A class and at least one subject are the minimum the tutor needs in
  /// order to scope retrieval. Everything else has a workable default.
  bool get isComplete => classLevel != null && subjectCodes.isNotEmpty;

  AcademicSetup copyWith({
    int? classLevel,
    String? curriculum,
    Medium? medium,
    Set<String>? subjectCodes,
    String? targetExam,
    int? dailyGoalMinutes,
  }) {
    return AcademicSetup(
      classLevel: classLevel ?? this.classLevel,
      curriculum: curriculum ?? this.curriculum,
      medium: medium ?? this.medium,
      subjectCodes: subjectCodes ?? this.subjectCodes,
      targetExam: targetExam ?? this.targetExam,
      dailyGoalMinutes: dailyGoalMinutes ?? this.dailyGoalMinutes,
    );
  }

  @override
  List<Object?> get props => [
    classLevel,
    curriculum,
    medium,
    subjectCodes,
    targetExam,
    dailyGoalMinutes,
  ];
}

final academicSetupProvider = NotifierProvider<AcademicSetupController, AcademicSetup>(
  AcademicSetupController.new,
);

class AcademicSetupController extends Notifier<AcademicSetup> {
  @override
  AcademicSetup build() => const AcademicSetup();

  void setClassLevel(int value) => state = state.copyWith(classLevel: value);
  void setMedium(Medium value) => state = state.copyWith(medium: value);
  void setTargetExam(String? value) => state = state.copyWith(targetExam: value);
  void setDailyGoal(int minutes) => state = state.copyWith(dailyGoalMinutes: minutes);

  void toggleSubject(String code) {
    final next = Set<String>.from(state.subjectCodes);
    next.contains(code) ? next.remove(code) : next.add(code);
    state = state.copyWith(subjectCodes: next);
  }
}

/// The six MVP subjects — doc 01.
///
/// Hard-coded for now. Weeks 3–4 replaces this with `GET /api/v1/subjects`
/// filtered by the chosen class, once the curriculum module exists.
const List<({String code, String name, String nameBn})> mvpSubjects = [
  (code: 'math', name: 'Mathematics', nameBn: 'গণিত'),
  (code: 'physics', name: 'Physics', nameBn: 'পদার্থবিজ্ঞান'),
  (code: 'chemistry', name: 'Chemistry', nameBn: 'রসায়ন'),
  (code: 'biology', name: 'Biology', nameBn: 'জীববিজ্ঞান'),
  (code: 'ict', name: 'ICT', nameBn: 'তথ্য ও যোগাযোগ প্রযুক্তি'),
  (code: 'english', name: 'English', nameBn: 'ইংরেজি'),
];
