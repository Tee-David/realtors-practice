import { Response } from "express";

interface ApiResponseOptions {
  success: boolean;
  data?: unknown;
  message?: string;
  error?: string;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
  };
}

export function sendResponse(
  res: Response,
  statusCode: number,
  options: ApiResponseOptions
) {
  return res.status(statusCode).json({
    success: options.success,
    ...(options.data !== undefined && { data: options.data }),
    ...(options.message && { message: options.message }),
    ...(options.error && { error: options.error }),
    ...(options.meta && { meta: options.meta }),
  });
}

export function sendSuccess(
  res: Response,
  data?: unknown,
  message?: string,
  statusCode = 200
) {
  return sendResponse(res, statusCode, { success: true, data, message });
}

export function sendError(
  res: Response,
  error: string,
  statusCode = 500,
  message?: string
) {
  return sendResponse(res, statusCode, { success: false, error, message });
}

export function sendPaginated(
  res: Response,
  data: unknown,
  total: number,
  page: number,
  limit: number
) {
  return sendResponse(res, 200, {
    success: true,
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
}
