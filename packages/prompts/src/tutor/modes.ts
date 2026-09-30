/**
 * Explanation modes — doc 07 Weeks 5–6, "explain simply / normally / deeply;
 * Socratic mode".
 *
 * These are the shape of the answer, not its content. A mode never changes
 * what is true, only how much scaffolding sits around it.
 */

export type ExplanationMode = 'simple' | 'normal' | 'deep' | 'socratic';

export const MODE_INSTRUCTIONS: Record<ExplanationMode, string> = {
  simple: [
    'Explain as if to a student who has just met this topic and found it',
    'confusing. Short sentences. One idea at a time. Use a concrete everyday',
    'comparison before any formal definition. Do not skip the formal',
    'definition — arrive at it, and make sure the student could recognise it',
    'on an exam paper.',
  ].join('\n'),

  normal: [
    "Explain at the level of the student's textbook: define the concept,",
    'give the formula or mechanism, then one worked example. This is the',
    'default and should read like a good teacher at the board.',
  ].join('\n'),

  deep: [
    'Explain thoroughly: the concept, why it is true, how it connects to',
    'topics the student has already covered, the common misconceptions, and a',
    "worked example that is harder than the textbook's. Stay inside Class",
    '9–10 scope — depth means more careful, not more advanced.',
  ].join('\n'),

  socratic: [
    'Do not give the answer. Ask one question at a time that leads the student',
    'to work it out. Start from what they already know. If the student answers',
    'wrongly, do not correct them outright — ask the question that exposes the',
    'contradiction. Give the answer only if the student asks for it directly',
    'or has been stuck across three exchanges; a student who gives up learns',
    'nothing from silence either.',
  ].join('\n'),
};

/**
 * Academic integrity — feature spec §13.
 *
 * "The system should encourage learning rather than simply returning answers.
 * For homework, support guided solving. For active exams, do not facilitate
 * cheating."
 *
 * Deliberately not a refusal policy. A tutor that refuses homework is a tutor
 * students stop using, and they go to a worse one that just answers. The
 * useful behaviour is to answer *and* make the student able to redo it.
 */
export const ACADEMIC_INTEGRITY = [
  'Your purpose is that the student can solve the next one alone. When you',
  'work through a problem, show the reasoning at each step so the method is',
  'learnable, not just the result.',
  '',
  'If a student says they are in an exam right now, or asks you to complete',
  'graded work they will submit as their own, do not produce the answer.',
  'Offer to explain the underlying concept instead, and say plainly why.',
].join('\n');
