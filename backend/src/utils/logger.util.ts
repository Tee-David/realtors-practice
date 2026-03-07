export class Logger {
  private static timestamp(): string {
    return new Date().toISOString();
  }

  static info(message: string, ...args: unknown[]): void {
    console.log(`[${this.timestamp()}] INFO: ${message}`, ...args);
  }

  static warn(message: string, ...args: unknown[]): void {
    console.warn(`[${this.timestamp()}] WARN: ${message}`, ...args);
  }

  static error(message: string, ...args: unknown[]): void {
    console.error(`[${this.timestamp()}] ERROR: ${message}`, ...args);
  }

  static debug(message: string, ...args: unknown[]): void {
    if (process.env.NODE_ENV === "development") {
      console.debug(`[${this.timestamp()}] DEBUG: ${message}`, ...args);
    }
  }
}
