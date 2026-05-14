export type CoreErrorCode =
  | "VALIDATION_FAILED"
  | "NOT_FOUND"
  | "CONFLICT"
  | "UNSAFE_NAME"
  | "PRECONDITION_FAILED"
  | "INTERNAL_ERROR";

export type FieldError = {
  field: string;
  message: string;
};

export type CoreErrorOptions = {
  code: CoreErrorCode;
  message: string;
  status?: number;
  fields?: FieldError[];
  cause?: unknown;
};

const DEFAULT_STATUS_BY_CODE: Record<CoreErrorCode, number> = {
  VALIDATION_FAILED: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNSAFE_NAME: 400,
  PRECONDITION_FAILED: 412,
  INTERNAL_ERROR: 500,
};

export class CoreError extends Error {
  readonly code: CoreErrorCode;
  readonly status: number;
  readonly fields: FieldError[];
  override readonly cause?: unknown;

  constructor(options: CoreErrorOptions) {
    super(options.message);
    this.name = "CoreError";
    this.code = options.code;
    this.status = options.status ?? DEFAULT_STATUS_BY_CODE[options.code];
    this.fields = options.fields ?? [];
    this.cause = options.cause;
  }
}

export type CoreResult<T> = { ok: true; value: T } | { ok: false; error: CoreError };

export function isCoreError(error: unknown): error is CoreError {
  return error instanceof CoreError;
}

export function validationError(message: string, fields: FieldError[] = []): CoreError {
  return new CoreError({ code: "VALIDATION_FAILED", message, fields });
}

export function notFoundError(message: string): CoreError {
  return new CoreError({ code: "NOT_FOUND", message });
}

export function conflictError(message: string): CoreError {
  return new CoreError({ code: "CONFLICT", message });
}

export function unsafeNameError(message: string, field = "name"): CoreError {
  return new CoreError({ code: "UNSAFE_NAME", message, fields: [{ field, message }] });
}

export function preconditionFailedError(message: string): CoreError {
  return new CoreError({ code: "PRECONDITION_FAILED", message });
}

export function toCoreError(error: unknown): CoreError {
  if (isCoreError(error)) return error;
  return new CoreError({ code: "INTERNAL_ERROR", message: error instanceof Error ? error.message : String(error), cause: error });
}

export function toErrorResponse(error: unknown): { code: CoreErrorCode; message: string; fields?: FieldError[] } {
  const coreError = toCoreError(error);
  return {
    code: coreError.code,
    message: coreError.message,
    ...(coreError.fields.length ? { fields: coreError.fields } : {}),
  };
}
