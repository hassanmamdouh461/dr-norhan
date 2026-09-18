export interface LogPayload {
  level: 'info' | 'warn' | 'error';
  event: string;
  message?: string;
  timestamp?: string;
  [key: string]: unknown;
}

export function logStructured(payload: LogPayload) {
  const timestamp = new Date().toISOString();
  const logObj = { timestamp, ...payload };
  if (payload.level === 'error') {
    console.error(JSON.stringify(logObj));
  } else if (payload.level === 'warn') {
    console.warn(JSON.stringify(logObj));
  } else {
    console.log(JSON.stringify(logObj));
  }
}

export function logError(event: string, err: unknown, meta: Record<string, unknown> = {}) {
  logStructured({
    level: 'error',
    event,
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
    ...meta,
  });
}

export function logWarn(event: string, message: string, meta: Record<string, unknown> = {}) {
  logStructured({
    level: 'warn',
    event,
    message,
    ...meta,
  });
}

export function logInfo(event: string, message: string, meta: Record<string, unknown> = {}) {
  logStructured({
    level: 'info',
    event,
    message,
    ...meta,
  });
}
