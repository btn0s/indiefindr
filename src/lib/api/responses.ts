import { NextResponse } from "next/server";
import { ZodError } from "zod";

export type ApiSuccessResponse<T = unknown> = {
  success: true;
  data: T;
};

export type ApiErrorResponse = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

export const ErrorCodes = {
  BAD_REQUEST: "BAD_REQUEST",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  NOT_FOUND: "NOT_FOUND",
  FORBIDDEN: "FORBIDDEN",
  RATE_LIMITED: "RATE_LIMITED",

  INTERNAL_ERROR: "INTERNAL_ERROR",
  EXTERNAL_API_ERROR: "EXTERNAL_API_ERROR",
  DATABASE_ERROR: "DATABASE_ERROR",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export function apiSuccess<T>(data: T, status = 200): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json({ success: true, data }, { status });
}

export function apiError(
  code: ErrorCode,
  message: string,
  status: number,
  details?: unknown
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      success: false,
      error: { code, message, ...(details !== undefined && { details }) },
    },
    { status }
  );
}

export function apiValidationError(error: ZodError): NextResponse<ApiErrorResponse> {
  const issues = error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));

  return apiError(
    ErrorCodes.VALIDATION_ERROR,
    "Validation failed",
    400,
    { issues }
  );
}

export function apiNotFound(resource: string): NextResponse<ApiErrorResponse> {
  return apiError(ErrorCodes.NOT_FOUND, `${resource} not found`, 404);
}

export function apiInternalError(message = "An unexpected error occurred"): NextResponse<ApiErrorResponse> {
  return apiError(ErrorCodes.INTERNAL_ERROR, message, 500);
}

export function apiDatabaseError(message: string): NextResponse<ApiErrorResponse> {
  return apiError(ErrorCodes.DATABASE_ERROR, message, 500);
}

export function apiRateLimited(message = "Too many requests"): NextResponse<ApiErrorResponse> {
  return apiError(ErrorCodes.RATE_LIMITED, message, 429);
}

export function apiForbidden(message = "Access denied"): NextResponse<ApiErrorResponse> {
  return apiError(ErrorCodes.FORBIDDEN, message, 403);
}

export function handleApiError(error: unknown): NextResponse<ApiErrorResponse> {
  if (error instanceof ZodError) {
    return apiValidationError(error);
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes("not found") || message.includes("unavailable")) {
      return apiNotFound("Resource");
    }

    if (message.includes("rate limit") || message.includes("429")) {
      return apiRateLimited();
    }

    return apiInternalError(error.message);
  }

  return apiInternalError();
}
