import { Request, Response, NextFunction } from "express";
import { errorResponse } from "../utils/responseFormatter";

export class ApiError extends Error {
  statusCode: number;
  code: string;
  details?: any;

  constructor(statusCode: number, message: string, code: string = "API_ERROR", details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export const errorHandler = (
  err: Error | ApiError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error("[Functions Error]:", err);

  if (err instanceof ApiError) {
    res.status(err.statusCode).json(errorResponse(err.message, err.code, err.details));
    return;
  }

  res.status(500).json(errorResponse("An unexpected server error occurred.", "INTERNAL_SERVER_ERROR"));
};
