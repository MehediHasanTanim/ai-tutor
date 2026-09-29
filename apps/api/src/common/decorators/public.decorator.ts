import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Opts a route out of the global JWT guard.
 *
 * Authentication is default-on: a new endpoint is protected unless someone
 * deliberately marks it public, which is the safer direction for the mistake
 * to go in.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
