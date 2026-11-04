export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    code: string;
    details?: any;
  };
  timestamp: string;
}

export const successResponse = <T>(data: T, message?: string): ApiResponse<T> => ({
  success: true,
  message,
  data,
  timestamp: new Date().toISOString(),
});

export const errorResponse = (
  message: string,
  code: string = "INTERNAL_SERVER_ERROR",
  details?: any
): ApiResponse => ({
  success: false,
  message,
  error: {
    code,
    details,
  },
  timestamp: new Date().toISOString(),
});
