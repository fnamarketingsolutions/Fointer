export const getErrorMessage = (error, fallback = 'Something went wrong.') =>
  error?.response?.data?.message || fallback;
