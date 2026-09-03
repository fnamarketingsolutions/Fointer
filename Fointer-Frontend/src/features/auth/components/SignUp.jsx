import React, { useEffect, useState } from 'react';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import {
  LuArrowLeft as ArrowLeft
} from 'react-icons/lu';
import { Link, useNavigate } from 'react-router-dom';
import { signupUser, resendVerificationEmail, verifyEmailOtp } from '../../../api/auth';
import { useAuth } from '../../../context/AuthContext';
import { useSocialAuth } from '../hooks/useSocialAuth';
import { useToast } from '../../../shared/components/feedback/ToastContext';
import SocialAuthButtons from './SocialAuthButtons';
import BrandLogo from '../../../shared/components/BrandLogo';
import ThemeToggle from '../../../shared/components/ThemeToggle';
import { getDashboardPathForRole } from '../../../shared/lib/roles';

export default function SignUp() {
  const navigate = useNavigate();
  const { loginSuccess } = useAuth();
  const { showToast } = useToast();
  const {
    loading: socialLoading,
    error: socialError,
    setError: setSocialError,
    pendingVerification,
    clearPendingVerification,
    handleGoogleCredential,
    handleFacebookAuth,
  } = useSocialAuth();

  const [formData, setFormData] = useState({
    username: '',
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  const activeVerificationEmail = verificationEmail || pendingVerification?.email || '';

  useEffect(() => {
    if (socialError) showToast(socialError);
  }, [socialError, showToast]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setEmailLoading(true);
    setSocialError('');
    clearPendingVerification();

    try {
      const response = await signupUser(formData);
      if (response?.success) {
        setVerificationEmail(response?.email || formData.email);
        setOtp('');
        showToast(
          response?.message || 'Account created. Enter the OTP sent to your email.'
        );
      } else {
        showToast(response?.message || 'Sign up failed.');
      }
    } catch (error) {
      showToast(error?.response?.data?.message || 'Sign up failed. Please try again.');
    } finally {
      setEmailLoading(false);
    }
  };

  const handleResend = async () => {
    if (!activeVerificationEmail) return;

    setResendLoading(true);

    try {
      const response = await resendVerificationEmail(activeVerificationEmail);
      showToast(response?.message || 'OTP sent again.');
    } catch (error) {
      showToast(error?.response?.data?.message || 'Could not resend OTP.');
    } finally {
      setResendLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!activeVerificationEmail || otp.length !== 6) return;

    setVerifyLoading(true);

    try {
      const response = await verifyEmailOtp(activeVerificationEmail, otp);
      if (response?.success && response.user) {
        loginSuccess(response.user);
        navigate(getDashboardPathForRole(response.user.role));
      }
    } catch (error) {
      showToast(error?.response?.data?.message || 'OTP verification failed.');
    } finally {
      setVerifyLoading(false);
    }
  };

  const inputClass =
    'w-full px-4 py-3 rounded-lg bg-fo-surface-hover border border-fo-border text-fo-auth-fg placeholder-fo-auth-muted focus:outline-none focus:border-fo-brand transition-all text-sm';

  return (
    <div className="auth-page relative min-h-screen w-full flex flex-col md:flex-row font-sans overflow-x-hidden">
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>
      <div
        className="auth-hero relative md:w-1/2 w-full min-h-[450px] md:min-h-screen flex flex-col justify-between p-8 md:p-14 bg-cover bg-center overflow-hidden"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(19, 13, 8, 0.65), rgba(19, 13, 8, 0.85)), url('https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=1200&auto=format&fit=crop')`,
        }}
      >
        <div>
          <BrandLogo />
          <h1 className="auth-hero-title text-4xl md:text-6xl font-serif leading-tight mt-6">
            Connect. Engage.<br />
            <span className="italic font-normal">Grow.</span>
          </h1>
        </div>

        <div className="mt-12 md:mt-0 space-y-6">
          <p className="auth-hero-lead text-sm md:text-base max-w-md leading-relaxed font-light">
            Join the next generation of community networking. An exclusive ecosystem designed for high-impact leaders and creative visionaries.
          </p>

          <div className="auth-hero-separator pt-4 border-t flex items-center space-x-3">
            <div className="flex -space-x-2 overflow-hidden">
              <img className="auth-hero-avatar inline-block h-8 w-8 rounded-full ring-2" src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80" alt="user" />
              <img className="auth-hero-avatar inline-block h-8 w-8 rounded-full ring-2" src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80" alt="user" />
              <img className="auth-hero-avatar inline-block h-8 w-8 rounded-full ring-2" src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&q=80" alt="user" />
            </div>
            <span className="auth-hero-meta text-xs font-medium">
              <strong>12k+</strong> professionals active today
            </span>
          </div>
        </div>
      </div>

      <div className="md:w-1/2 w-full flex flex-col justify-between p-8 md:p-14">
        <div className="max-w-md w-full mx-auto my-auto py-8">
          <div className="mb-8">
            <button
              onClick={() => window.history.back()}
              className="mb-4 inline-flex items-center text-xs font-medium text-fo-text hover:text-fo-brand transition-colors group cursor-pointer border-b border-fo-border hover:border-fo-brand pb-1 gap-1"
              aria-label="Go back"
            >
              <div className="transition-all">
                <ArrowLeft className="w-4 h-4 text-fo-text group-hover:text-fo-brand group-hover:-translate-x-0.5 transition-transform" />
              </div>
              <span className="tracking-wide text-fo-text group-hover:text-fo-brand transition-colors">Go Back</span>
            </button>

            <h2 className="text-3xl font-serif text-fo-text">Create an Account</h2>
            <p className="text-xs text-fo-subtle mt-2">
              Enter your details to register and get started.
            </p>
          </div>

          {!activeVerificationEmail ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-fo-muted uppercase tracking-wider mb-1.5">
                  Username
                </label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  placeholder="john_doe"
                  required
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-fo-muted uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="John Doe"
                  required
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-fo-muted uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="john@example.com"
                  required
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-fo-muted uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    required
                    className={`${inputClass} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-fo-subtle hover:text-fo-brand transition-colors"
                  >
                    {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-fo-muted uppercase tracking-wider mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="••••••••"
                    required
                    className={`${inputClass} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-fo-subtle hover:text-fo-brand transition-colors"
                  >
                    {showConfirmPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                  </button>
                </div>
              </div>

              <SocialAuthButtons
                primarySlot={
                  <button
                    type="submit"
                    disabled={emailLoading}
                    className="w-full py-3 px-4 bg-fo-brand text-fo-brand-fg font-bold text-sm rounded-lg hover:bg-fo-brand-hover transition-colors shadow-md shadow-fo-brand/10 active:scale-[0.98] disabled:opacity-50"
                  >
                    {emailLoading ? 'Signing up...' : 'Sign Up'}
                  </button>
                }
                onGoogleCredential={handleGoogleCredential}
                onFacebookClick={handleFacebookAuth}
                googleLoading={socialLoading.google}
                facebookLoading={socialLoading.facebook}
              />
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-fo-muted uppercase tracking-wider mb-1.5">
                  6-Digit OTP
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  required
                  className={`${inputClass} text-center tracking-[0.35em] text-lg`}
                />
              </div>

              <button
                type="submit"
                disabled={verifyLoading || otp.length !== 6}
                className="w-full py-3 px-4 bg-fo-brand text-fo-brand-fg font-bold text-sm rounded-lg hover:bg-fo-brand-hover transition-colors shadow-md shadow-fo-brand/10 active:scale-[0.98] disabled:opacity-50"
              >
                {verifyLoading ? 'Verifying...' : 'Verify & Login'}
              </button>
            </form>
          )}

          <p className="text-center text-xs text-fo-subtle mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-fo-brand hover:underline font-medium">
              Log in
            </Link>
          </p>

          {activeVerificationEmail && (
            <div className="mt-4 text-center text-xs text-fo-subtle">
              Didn&apos;t get the OTP?{' '}
              <button
                type="button"
                onClick={handleResend}
                disabled={resendLoading}
                className="text-fo-brand hover:underline font-medium disabled:opacity-50"
              >
                {resendLoading ? 'Sending...' : 'Resend OTP'}
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between pt-6 border-t border-fo-border text-[11px] text-fo-subtle gap-2">
          <span>© 2026 Fointer</span>
          <div className="flex space-x-4">
            <Link to="/privacy-policy" className="hover:text-fo-muted transition-colors">Privacy</Link>
            <Link to="/terms-and-conditions" className="hover:text-fo-muted transition-colors">Terms</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
