export function createHttpError(statusCode, message, details) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.details = details;
  return error;
}

export function asyncHandler(handler) {
  return async function wrappedHandler(req, res, next) {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

export function sendSuccess(res, statusCode, data = {}) {
  return res.status(statusCode).json({
    success: true,
    ...data
  });
}

export function sendError(res, statusCode, message, details) {
  return res.status(statusCode).json({
    success: false,
    error: message,
    ...(details ? { details } : {})
  });
}
