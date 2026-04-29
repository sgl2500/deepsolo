const DEBUG_LOG_STORAGE_KEY = 'deepsolo:debugLogs';

type LogArg = unknown;

function isDebugLogEnabled(): boolean {
  try {
    return localStorage.getItem(DEBUG_LOG_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function prefix(scope: string, message: string): string {
  return `[${scope}] ${message}`;
}

export const DebugLogger = {
  info(scope: string, message: string, ...args: LogArg[]): void {
    if (!isDebugLogEnabled()) return;
    console.info(prefix(scope, message), ...args);
  },

  userInfo(scope: string, message: string, ...args: LogArg[]): void {
    console.info(prefix(scope, message), ...args);
  },
};
