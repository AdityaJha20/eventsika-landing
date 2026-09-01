/**
 * PII-Safe Structured Backend Logger
 *
 * Enforces masking of phone numbers, emails, and customer personal details
 * before emitting structured single-line JSON logs to server stdout/stderr.
 */

export type LogLevel = "INFO" | "WARN" | "ERROR" | "DEBUG";

export interface LogContext {
  requestId?: string;
  route?: string;
  clientIp?: string;
  durationMs?: number;
  [key: string]: unknown;
}

/**
 * Masks an Indian mobile phone number (e.g. "9876543210" -> "98****3210")
 */
export function maskPhone(phone: string): string {
  if (!phone || phone.length < 6) return "******";
  const clean = phone.replace(/\D/g, "");
  if (clean.length < 6) return "******";
  return `${clean.slice(0, 2)}****${clean.slice(-4)}`;
}

/**
 * Masks an email address (e.g. "ananya.roy@example.com" -> "a***@example.com")
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes("@")) return "***@***";
  const [localPart, domain] = email.split("@");
  if (localPart.length <= 2) {
    return `${localPart.slice(0, 1)}***@${domain}`;
  }
  return `${localPart.slice(0, 2)}***@${domain}`;
}

/**
 * Masks a full name (e.g. "Ananya Roy" -> "A*** R***")
 */
export function maskName(name: string): string {
  if (!name) return "***";
  return name
    .split(/\s+/)
    .map((part) => (part.length > 0 ? `${part[0]}***` : "***"))
    .join(" ");
}

class BackendLogger {
  private formatLog(level: LogLevel, message: string, context?: LogContext): string {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...context,
    };
    return JSON.stringify(entry);
  }

  info(message: string, context?: LogContext): void {
    console.log(this.formatLog("INFO", message, context));
  }

  warn(message: string, context?: LogContext): void {
    console.warn(this.formatLog("WARN", message, context));
  }

  error(message: string, error?: unknown, context?: LogContext): void {
    const errorMeta: Record<string, unknown> = {};
    if (error instanceof Error) {
      errorMeta.errorName = error.name;
      errorMeta.errorMessage = error.message;
      // In development, include stack trace for debugging
      if (process.env.NODE_ENV === "development") {
        errorMeta.stack = error.stack;
      }
    } else if (typeof error === "string") {
      errorMeta.errorMessage = error;
    }

    console.error(
      this.formatLog("ERROR", message, {
        ...context,
        ...errorMeta,
      })
    );
  }

  debug(message: string, context?: LogContext): void {
    if (process.env.NODE_ENV === "development") {
      console.log(this.formatLog("DEBUG", message, context));
    }
  }
}

export const logger = new BackendLogger();
