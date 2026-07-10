export type AppError = {
  code: string;
  message: string;
  status?: number;
  details?: unknown;
};

export type Ok<T> = { ok: true; value: T };
export type Err = { ok: false; error: AppError };

export type Result<T> = Ok<T> | Err;

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

export function err(error: AppError | string, status?: number): Err {
  const e: AppError =
    typeof error === "string"
      ? { code: "error", message: error, status }
      : { ...error, status: error.status ?? status };
  return { ok: false, error: e };
}

export function isOk<T>(r: Result<T>): r is Ok<T> {
  return r.ok;
}

export function isErr<T>(r: Result<T>): r is Err {
  return !r.ok;
}

export function unwrap<T>(r: Result<T>): T {
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

export function mapResult<T, U>(r: Result<T>, fn: (value: T) => U): Result<U> {
  return r.ok ? ok(fn(r.value)) : r;
}

export function toNextResponse<T>(r: Result<T>, statusOk = 200) {
  if (r.ok) return Response.json(r.value, { status: statusOk });
  return Response.json(
    { error: r.error.message, code: r.error.code },
    { status: r.error.status ?? 400 }
  );
}
