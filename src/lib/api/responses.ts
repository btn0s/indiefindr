/**
 * Standardized API response utilities
 */
import { NextResponse } from "next/server";
import { ZodError } from "zod";

// =============================================================================
// Response Types
// =============================================================================

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

// =============================================================================
// Error Codes
// =============================================================================

export const ErrorCodes = {
  // Client errors (4xx)
  BAD_REQUEST: "BAD_REQUEST",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  NOT_FOUND: "NOT_FOUND",
  FORBIDDEN: "FORBIDDEN",
  RATE_LIMITED: "RATE_LIMITED",

  // Server errors (5xx)
  INTERNAL_ERROR: "INTERNAL_ERROR",
  EXTERNAL_API_ERROR: "EXTERNAL_API_ERROR",
  DATABASE_ERROR: "DATABASE_ERROR",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

// =============================================================================
// Response Helpers
// =============================================================================

/**
 * Create a successful API response
 */
export function apiSuccess<T>(data: T, status = 200): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json({ success: true, data }, { status });
}

/**
 * Create an error API response
 */
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

/**
 * Create a validation error response from ZodError
 */
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

/**
 * Create a not found error response
 */
export function apiNotFound(resource: string): NextResponse<ApiErrorResponse> {
  return apiError(ErrorCodes.NOT_FOUND, `${resource} not found`, 404);
}

/**
 * Create an internal server error response
 */
export function apiInternalError(message = "An unexpected error occurred"): NextResponse<ApiErrorResponse> {
  return apiError(ErrorCodes.INTERNAL_ERROR, message, 500);
}

/**
 * Create a database error response
 */
export function apiDatabaseError(message: string): NextResponse<ApiErrorResponse> {
  return apiError(ErrorCodes.DATABASE_ERROR, message, 500);
}

/**
 * Create a rate limit error response
 */
export function apiRateLimited(message = "Too many requests"): NextResponse<ApiErrorResponse> {
  return apiError(ErrorCodes.RATE_LIMITED, message, 429);
}

/**
 * Create a forbidden error response
 */
export function apiForbidden(message = "Access denied"): NextResponse<ApiErrorResponse> {
  return apiError(ErrorCodes.FORBIDDEN, message, 403);
}

/**
 * Handle unknown errors and return appropriate API response
 */
export function handleApiError(error: unknown): NextResponse<ApiErrorResponse> {
  // Zod validation errors
  if (error instanceof ZodError) {
    return apiValidationError(error);
  }

  // Standard errors
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Not found errors
    if (message.includes("not found") || message.includes("unavailable")) {
      return apiNotFound("Resource");
    }

    // Rate limit errors
    if (message.includes("rate limit") || message.includes("429")) {
      return apiRateLimited();
    }

    return apiInternalError(error.message);
  }

  return apiInternalError();
}
