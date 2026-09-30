'use client';

import { useActionState } from 'react';
import type { SubjectSummary } from '@ai-tutor/shared-types';
import { uploadAction, type ActionState } from '@/lib/actions';

const initial: ActionState = {};

const DOCUMENT_TYPES = [
  { value: 'TEXTBOOK', label: 'Textbook' },
  { value: 'QUESTION_PAPER', label: 'Question paper' },
  { value: 'NOTE', label: 'Note' },
  { value: 'SOLUTION_GUIDE', label: 'Solution guide' },
];

export function UploadForm({ subjects }: { subjects: SubjectSummary[] }) {
  const [state, action, pending] = useActionState(uploadAction, initial);

  return (
    <form action={action} className="card">
      {state.error && <div className="alert alert-error">{state.error}</div>}
      {state.success && <div className="alert alert-ok">{state.success}</div>}

      <div className="field">
        <label htmlFor="file">File</label>
        <input
          id="file"
          name="file"
          type="file"
          accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
          required
        />
        <p className="muted small" style={{ margin: '6px 0 0' }}>
          PDF, plain text or Markdown. Up to 50 MB.
        </p>
      </div>

      <div className="field">
        <label htmlFor="title">Title</label>
        <input
          id="title"
          name="title"
          required
          minLength={2}
          maxLength={255}
          placeholder="NCTB Physics Class 10 — Chapter 2: Motion"
        />
      </div>

      <div className="row">
        <div className="field">
          <label htmlFor="document_type">Type</label>
          <select id="document_type" name="document_type" defaultValue="TEXTBOOK">
            {DOCUMENT_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="subject_id">Subject</label>
          <select id="subject_id" name="subject_id" defaultValue="">
            <option value="">— unscoped (not retrievable) —</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                Class {subject.class_level} · {subject.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="field">
        <label htmlFor="source">Source (optional)</label>
        <input id="source" name="source" maxLength={255} placeholder="NCTB 2024 edition" />
      </div>

      <button type="submit" disabled={pending}>
        {pending ? 'Uploading…' : 'Upload and queue'}
      </button>
    </form>
  );
}
