import type { ErrorRequestHandler, Request } from 'express';
import { z, ZodError } from 'zod';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export function parseBody<S extends z.ZodType>(schema: S, req: Request): z.infer<S> {
  return schema.parse(req.body ?? {});
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Ungültige Eingabe', details: z.flattenError(err) });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, details: err.details });
    return;
  }
  if (err && typeof err === 'object' && 'type' in err && err.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Ungültiges JSON' });
    return;
  }
  if (err && typeof err === 'object' && 'type' in err && err.type === 'entity.too.large') {
    res.status(413).json({ error: 'Anfrage zu groß' });
    return;
  }
  console.error('[api] unhandled error', err);
  res.status(500).json({ error: 'Interner Serverfehler' });
};
