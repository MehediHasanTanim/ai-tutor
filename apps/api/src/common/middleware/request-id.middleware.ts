import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { REQUEST_ID_HEADER, type RequestWithContext } from '../request-context';

/**
 * Attaches a request id to every request and echoes it in the response header.
 *
 * Doc 07 §5.3: every response carries `request_id`, propagated to logs and to
 * Flutter error reporting. An inbound id is honoured so a trace survives a
 * proxy hop; otherwise one is minted here.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: RequestWithContext, res: Response, next: NextFunction): void {
    const inbound = req.header(REQUEST_ID_HEADER);
    const requestId = isValidRequestId(inbound) ? (inbound as string) : `req_${randomUUID()}`;

    req.requestId = requestId;
    res.setHeader(REQUEST_ID_HEADER, requestId);
    next();
  }
}

/**
 * Inbound ids end up in logs and in the error envelope, so they are bounded and
 * restricted to safe characters rather than reflected verbatim.
 */
function isValidRequestId(value: string | undefined): boolean {
  return typeof value === 'string' && value.length > 0 && /^[A-Za-z0-9_.:-]{1,64}$/.test(value);
}
