export function jsonError(
  error: string,
  code: string | undefined,
  status: number
): Response {
  return Response.json({ error, code }, { status });
}

export function jsonBody<T>(data: T, init: ResponseInit = {}): Response {
  return Response.json(data, {
    ...init,
    headers: { "content-type": "application/json", ...init.headers }
  });
}
