/**
 * Never send raw Error.message / driver stack details to API clients.
 */
export const safeErrorMessage = (
  error,
  fallback = "Something went wrong. Please try again."
) => {
  if (error?.isOperational && typeof error.message === "string" && error.message) {
    return error.message;
  }
  return fallback;
};

export const sendServerError = (
  res,
  error,
  fallback = "Something went wrong. Please try again."
) => {
  if (error) {
    console.error(error);
  }
  return res.status(500).json({
    success: false,
    message: safeErrorMessage(error, fallback),
  });
};
