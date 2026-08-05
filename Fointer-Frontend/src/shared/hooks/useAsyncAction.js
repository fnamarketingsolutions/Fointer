import { useCallback, useState } from 'react';
import { useToast } from '../components/feedback/ToastContext';

/**
 * Manages loading state for async actions and surfaces failures via toast.
 */
export default function useAsyncAction() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = useCallback(
    async (action, fallbackMessage = 'Something went wrong.') => {
      setLoading(true);
      setError('');
      try {
        return await action();
      } catch (err) {
        const message = err?.response?.data?.message || fallbackMessage;
        setError(message);
        showToast(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [showToast]
  );

  const clearError = useCallback(() => setError(''), []);

  return { loading, error, setError, clearError, run };
}
