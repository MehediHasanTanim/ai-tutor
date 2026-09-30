'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { ApiError, login } from './api';
import { clearSession, writeSession } from './session';
import { reprocessDocument, uploadDocument } from './knowledge';

/**
 * Server actions.
 *
 * Mutations run here rather than through a browser fetch, so the access token
 * never leaves the server. The forms below are plain HTML forms — they work
 * before hydration, which for an internal tool on a slow connection is worth
 * more than optimistic UI.
 */

export interface ActionState {
  error?: string;
  success?: string;
}

export async function loginAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const identifier = String(formData.get('identifier') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!identifier || !password) {
    return { error: 'Enter your phone or email and your password.' };
  }

  let session;
  try {
    session = await login(identifier, password);
  } catch (error) {
    if (error instanceof ApiError) {
      // The API's message is already safe to show and does not distinguish
      // "no such account" from "wrong password".
      return { error: error.message };
    }
    return { error: 'Could not reach the API. Is it running on port 4000?' };
  }

  if (session.role !== 'ADMIN') {
    // Checked here as well as server-side. The API enforces RBAC on every
    // admin route, so a student token would be rejected anyway — this just
    // gives a comprehensible message instead of a wall of 403s.
    return { error: 'This account is not an administrator.' };
  }

  await writeSession({
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
  });

  redirect('/documents');
}

export async function logoutAction(): Promise<void> {
  await clearSession();
  redirect('/login');
}

export async function uploadAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Choose a file to upload.' };
  }

  // Empty optional fields must be dropped, not sent as '': the API's
  // validation pipe rejects a non-UUID string, and '' is one.
  for (const key of ['subject_id', 'chapter_id', 'source']) {
    if (formData.get(key) === '') formData.delete(key);
  }

  try {
    const result = await uploadDocument(formData);
    revalidatePath('/documents');
    revalidatePath('/status');

    return {
      success: result.deduplicated
        ? `Those exact bytes are already ingested as "${result.document.title}". ` +
          'Nothing was queued.'
        : `Queued "${result.document.title}" for processing.`,
    };
  } catch (error) {
    return { error: error instanceof ApiError ? error.message : 'Upload failed.' };
  }
}

export async function reprocessAction(formData: FormData): Promise<void> {
  const id = String(formData.get('document_id') ?? '');
  if (!id) return;

  await reprocessDocument(id);
  revalidatePath('/documents');
  revalidatePath('/status');
}
