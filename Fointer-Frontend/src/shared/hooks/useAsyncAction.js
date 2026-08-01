import { useCallback, useState } from 'react';

/**
 * Manages loading/error state for async actions.
 */
export default function useAsyncAction() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = useCallback(async (action, fallbackMessage = 'Something went wrong.') => {
    setLoading(true);
    setError('');
    try {
      return await action();
    } catch (err) {
      setError(err?.response?.data?.message || fallbackMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => setError(''), []);

  return { loading, error, setError, clearError, run };
}
