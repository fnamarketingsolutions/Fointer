import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { resendVerificationEmail, verifyEmail } from '../api/auth';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const email = params.get('email');
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('Verifying your email...');
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    const runVerification = async () => {
      if (!token) {
        setStatus('error');
        setMessage('Verification link is missing its token.');
        return;
      }

      try {
        const response = await verifyEmail(token);
        setStatus('success');
        setMessage(response?.message || 'Email verified successfully.');
      } catch (error) {
        setStatus('error');
        setMessage(
          error?.response?.data?.message ||
            'This verification link is invalid or has expired.'
        );
      }
    };

    runVerification();
  }, [token]);

  const canResend = useMemo(() => Boolean(email), [email]);

  const handleResend = async () => {
    if (!email) return;

    setResendLoading(true);
    try {
      const response = await resendVerificationEmail(email);
      setStatus('info');
      setMessage(response?.message || 'A new verification email has been sent.');
    } catch (error) {
      setStatus('error');
      setMessage(
        error?.response?.data?.message || 'Could not resend the verification email.'
      );
    } finally {
      setResendLoading(false);
    }
  };

  const boxClass =
    status === 'success'
      ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
      : status === 'loading'
        ? 'bg-amber-950/60 border-amber-500/40 text-amber-200'
        : 'bg-red-950/60 border-red-500/40 text-red-200';

  return (
    <div className="min-h-screen bg-[#130D08] text-white flex items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#1c140d]/80 backdrop-blur-md p-8 text-center shadow-2xl">
        <p className="text-xs uppercase tracking-[0.25em] text-[#F8A201] font-bold mb-3">
          Email Verification
        </p>
        <h1 className="text-3xl font-serif text-amber-50 mb-4">Verify Your Account</h1>

        <div className={`rounded-lg border p-4 text-sm leading-relaxed ${boxClass}`}>
          {message}
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <Link
            to="/login"
            className="w-full py-3 px-4 bg-[#F8A201] text-[#130D08] font-bold text-sm rounded-lg hover:bg-[#e09200] transition-colors"
          >
            Go to Login
          </Link>

          {canResend && status !== 'success' && (
            <button
              type="button"
              onClick={handleResend}
              disabled={resendLoading}
              className="w-full py-3 px-4 border border-[#F8A201]/40 text-[#F8A201] font-semibold text-sm rounded-lg hover:bg-[#F8A201]/10 transition-colors disabled:opacity-50"
            >
              {resendLoading ? 'Sending...' : 'Resend Verification Email'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
