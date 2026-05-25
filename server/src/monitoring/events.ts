export interface AppEvent {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  method: string;
  path: string;
  statusCode: number;
  responseTimeMs: number;
  message: string;
}

const MAX_EVENTS = 200;
const buffer: AppEvent[] = [];

export function pushEvent(event: AppEvent): void {
  if (buffer.length >= MAX_EVENTS) {
    buffer.shift();
  }
  buffer.push(event);
}

// Returns a copy of all buffered events, oldest first.
export function getEvents(): AppEvent[] {
  return buffer.slice();
}
