export type ApiError = {
  code: string;
  message: string;
  requestId?: string;
  details?: Record<string, unknown>;
  retryAfterSeconds?: number;
};

export type ApiResponse<T = unknown> = {
  ok: boolean;
  status: number;
  data?: T;
  error?: ApiError;
};

export type RequestInitExtended = {
  body?: unknown;
  headers?: Record<string, string>;
  timeout?: number;
};
