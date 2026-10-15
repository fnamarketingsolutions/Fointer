import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LuLoaderCircle as Loader2 } from 'react-icons/lu';
import { useToast } from '../../../shared/components/feedback/ToastContext';
import { getErrorMessage } from '../../../shared/utils/errors';
import { useEntitlement } from '../context/EntitlementContext';
import { verifySubscriptionPayment } from '../services/subscriptionService';

/**
 * Return URL after Flutterwave checkout.
 * Activation only happens after server-side verification — never from this page alone.
 */
export default function SubscriptionSuccess() {
  const [params] = useSearchParams();
  const { refreshEntitlement } = useEntitlement();
  const { showToast } = useToast();
  const [state, setState] = useState({ loading: true, ok: false, message: '' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const transactionId =
        params.get('transaction_id') ||
        params.get('transactionId') ||
        '';
      const txRef = params.get('tx_ref') || params.get('txRef') || '';
      if (!transactionId && !txRef) {
        if (!cancelled) {
          setState({
            loading: false,
            ok: false,
            message:
              'Missing payment reference. If you completed payment, open Subscription and refresh status.',
          });
        }
        return;
      }
      try {
        const result = await verifySubscriptionPayment({
          transaction_id: transactionId,
          providerTransactionId: transactionId,
          tx_ref: txRef,
        });
        await refreshEntitlement();
        if (!cancelled) {
          setState({
            loading: false,
            ok: Boolean(result?.entitlement?.adFreeActive || result?.success),
            message: result?.alreadyVerified
              ? 'Subscription already verified.'
              : 'Subscription verified. Ad-free is now active on this account.',
          });
        }
      } catch (error) {
        if (!cancelled) {
          const message = getErrorMessage(
            error,
            'Could not verify payment with the provider.'
          );
          setState({ loading: false, ok: false, message });
          showToast(message);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params, refreshEntitlement, showToast]);

  return (
    <div className="w-full max-w-md mx-auto py-12 px-4 text-center space-y-4 text-fo-text">
      {state.loading ? (
        <p className="inline-flex items-center gap-2 text-sm text-fo-subtle">
          <Loader2 className="animate-spin" size={18} /> Verifying payment…
        </p>
      ) : (
        <>
          <h1 className="text-xl font-semibold">
            {state.ok ? 'Ad-free activated' : 'Verification needed'}
          </h1>
          <p className="text-sm text-fo-subtle">{state.message}</p>
          <Link
            to="/subscription"
            className="inline-flex text-sm font-semibold text-fo-accent hover:underline"
          >
            View subscription
          </Link>
        </>
      )}
    </div>
  );
}
