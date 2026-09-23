import type { Request, Response } from "express";

export interface PageInfo {
  page: number;
  limit: number;
  total: number;
}

function baseMeta(req: Request) {
  return { requestId: req.requestId, timestamp: new Date().toISOString() };
}

/**
 * Standard success envelope: { success: true, data, message?, meta }.
 * `meta` carries requestId/timestamp and, for lists, pagination (frontend contract §1.2).
 */
export function sendSuccess<T>(
  req: Request,
  res: Response,
  data: T,
  options: { status?: number; message?: string } = {}
): void {
  res.status(options.status ?? 200).json({
    success: true,
    data,
    ...(options.message ? { message: options.message } : {}),
    meta: baseMeta(req),
  });
}

export function sendPaginated<T>(req: Request, res: Response, items: T[], page: PageInfo): void {
  res.status(200).json({
    success: true,
    data: items,
    meta: {
      page: page.page,
      limit: page.limit,
      total: page.total,
      totalPages: page.limit > 0 ? Math.ceil(page.total / page.limit) : 0,
      ...baseMeta(req),
    },
  });
}
