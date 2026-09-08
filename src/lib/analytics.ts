export function logEvent(eventName: string, payload: Record<string, unknown> = {}): void {
  console.log("[analytics]", eventName, payload);
}
