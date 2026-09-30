/**
 * Curriculum API contract — doc 04 "Curriculum" section.
 *
 * The read shapes the Flutter app consumes. Deliberately flatter than the
 * Prisma models: the app needs a subject's chapter count for the Learn tab
 * but not its `createdAt`, and shipping the ORM shape over the wire would
 * make every column rename a mobile release.
 */

import type { Difficulty } from './enums';

export interface CurriculumSummary {
  id: string;
  code: string;
  name: string;
  name_bn: string;
  /** Class levels this curriculum has content for, ascending. */
  class_levels: number[];
}

export interface SubjectSummary {
  id: string;
  code: string;
  name: string;
  name_bn: string;
  class_level: number;
  sort_order: number;
  chapter_count: number;
}

export interface SubjectDetail extends SubjectSummary {
  curriculum: { id: string; code: string; name: string };
  chapters: ChapterSummary[];
}

export interface ChapterSummary {
  id: string;
  subject_id: string;
  title: string;
  title_bn: string;
  chapter_number: number;
  topic_count: number;
}

export interface ChapterDetail extends ChapterSummary {
  description: string | null;
  description_bn: string | null;
  subject: { id: string; code: string; name: string; name_bn: string; class_level: number };
  topics: TopicSummary[];
}

export interface TopicSummary {
  id: string;
  chapter_id: string;
  title: string;
  title_bn: string;
  difficulty: Difficulty;
  sort_order: number;
}

/** Query filters for `GET /api/v1/subjects`. */
export interface SubjectListQuery {
  class_level?: number;
  curriculum?: string;
}
