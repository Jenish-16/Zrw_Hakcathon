export class AppError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'AppError';
  }
}

export const badRequest = (msg: string) => new AppError(400, msg);
export const unauthorized = (msg = 'Unauthorized') => new AppError(401, msg);
export const forbidden = (msg = 'You do not have permission to perform this action') =>
  new AppError(403, msg);
export const notFound = (msg = 'Resource not found') => new AppError(404, msg);
export const conflict = (msg: string) => new AppError(409, msg);
