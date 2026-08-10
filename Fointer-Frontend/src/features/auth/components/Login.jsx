import React, { useEffect, useState } from 'react';
import { FiEye, FiEyeOff, FiHome } from 'react-icons/fi';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { loginUser, resendVerificationEmail, verifyEmailOtp } from '../services/authService';
import { useAuth } from '../../../context/AuthContext';
import { useSocialAuth } from '../hooks/useSocialAuth';
import { useToast } from '../../../shared/components/feedback/ToastContext';
import SocialAuthButtons from './SocialAuthButtons';
import { getDashboardPathForRole } from '../../../shared/lib/roles';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginSuccess } = useAuth();
  const { showToast } = useToast();
  const {
    loading: socialLoading,
    error: socialError,
    setError: setSocialError,
    pendingVerification,
    clearPendingVerification,
    handleGoogleAuth,
    handleFacebookAuth,
  } = useSocialAuth();

  const [formData, setFormData] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  const redirectAfterLogin = (role) => {
    const from = location.state?.from;
    if (from && typeof from === 'string' && role !== 'admin') {
      navigate(from, { replace: true });
      return;
    }
    navigate(getDashboardPathForRole(role), { replace: true });
  };

  const activeVerificationEmail = verificationEmail || pendingVerification?.email || '';

  useEffect(() => {
    if (socialError) showToast(socialError);
  }, [socialError, showToast]);

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setEmailLoading(true);
    setVerificationEmail('');
    setSocialError('');
    clearPendingVerification();

    try {
      const response = await loginUser(formData);
      if (response?.success && response.user) {
        loginSuccess(response.user);
        redirectAfterLogin(response.user.role);
      } else {
        showToast(response?.message || 'Invalid email or password.');
      }
    } catch (error) {
      if (error?.response?.data?.requiresEmailVerification) {
        setVerificationEmail(error?.response?.data?.email || formData.email);
        setOtp('');
      }
      showToast(error?.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setEmailLoading(false);
    }
  };

  const handleResend = async () => {
    if (!activeVerificationEmail) return;

    setResendLoading(true);

    try {
      const response = await resendVerificationEmail(activeVerificationEmail);
      showToast(response?.message || 'OTP sent.');
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
        redirectAfterLogin(response.user.role);
      }
    } catch (error) {
      showToast(error?.response?.data?.message || 'OTP verification failed.');
    } finally {
      setVerifyLoading(false);
    }
  };

  const renderInputField = (label, name, type, placeholder, isPassword = false) => (
    <div>
      <div className="flex justify-between items-center mb-1.5">
        <label className="block text-xs font-medium text-gray-300 uppercase tracking-wider">
          {label}
        </label>
        {isPassword && (
          <a href="#" className="text-xs text-[#F8A201] hover:underline">
            Forgot?
          </a>
        )}
      </div>
      <div className="relative">
        <input
          type={isPassword ? (showPassword ? 'text' : 'password') : type}
          name={name}
          value={formData[name]}
          onChange={handleChange}
          placeholder={placeholder}
          required
          className="w-full px-4 py-3 rounded-lg bg-[#1c140d] border border-amber-900/30 text-white placeholder-gray-500 focus:outline-none focus:border-[#F8A201] transition-all text-sm pr-10"
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#F8A201] transition-colors"
          >
            {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-[#130D08] text-white font-sans overflow-x-hidden">
      <div
        className="relative md:w-1/2 w-full min-h-[450px] md:min-h-screen flex flex-col justify-between p-8 md:p-14 bg-cover bg-center overflow-hidden"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(19, 13, 8, 0.65), rgba(19, 13, 8, 0.85)), url('https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=1200&auto=format&fit=crop')`,
        }}
      >
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-[#F8A201] font-bold">
            Fointer
          </p>
          <h1 className="text-4xl md:text-6xl font-serif text-amber-50/90 leading-tight mt-6">
            Connect. Engage.<br />
            <span className="italic font-normal">Grow.</span>
          </h1>
        </div>

        <div className="mt-12 md:mt-0 space-y-6">
         
          <p className="text-gray-300 text-sm md:text-base max-w-md leading-relaxed font-light">
            Welcome back! Log in to re-connect with your network and explore high-impact opportunities.
          </p>

          <div className="pt-4 border-t border-white/10 flex items-center space-x-3">
            <div className="flex -space-x-2 overflow-hidden">
              <img className="inline-block h-8 w-8 rounded-full ring-2 ring-[#130D08]" src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80" alt="user" />
              <img className="inline-block h-8 w-8 rounded-full ring-2 ring-[#130D08]" src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80" alt="user" />
              <img className="inline-block h-8 w-8 rounded-full ring-2 ring-[#130D08]" src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&q=80" alt="user" />
            </div>
            <span className="text-xs text-gray-300 font-medium">
              <strong className="text-[#F8A201]">12k+</strong> professionals active today
            </span>
          </div>
        </div>
      </div>

      <div className="md:w-1/2 w-full flex flex-col justify-between p-8 md:p-14 bg-[#130D08]">
        <div className="max-w-md w-full mx-auto my-auto py-8">
          <div className="mb-8">
          <Link to="/">
          <FiHome size={24} className="text-[#F8A201] mb-2 hover:cursor-pointer" />
          </Link>
            <h2 className="text-3xl font-serif text-amber-50">Welcome Back</h2>
            <p className="text-xs text-gray-400 mt-2">
              Please enter your credentials to access your account.
            </p>
          </div>

          {!activeVerificationEmail ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              {renderInputField('Email Address', 'email', 'email', 'john@example.com')}
              {renderInputField('Password', 'password', 'password', '••••••••', true)}

              <SocialAuthButtons
                primarySlot={
                  <button
                    type="submit"
                    disabled={emailLoading}
                    className="w-full py-3 px-4 bg-[#F8A201] text-[#130D08] font-bold text-sm rounded-lg hover:bg-[#e09200] transition-colors shadow-md shadow-[#F8A201]/10 active:scale-[0.98] disabled:opacity-50"
                  >
                    {emailLoading ? 'Logging in...' : 'Login'}
                  </button>
                }
                onGoogleClick={() => handleGoogleAuth()}
                onFacebookClick={handleFacebookAuth}
                googleLoading={socialLoading.google}
                facebookLoading={socialLoading.facebook}
              />
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-gray-300 uppercase tracking-wider mb-1.5">
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
                  className="w-full px-4 py-3 rounded-lg bg-[#1c140d] border border-amber-900/30 text-white placeholder-gray-500 focus:outline-none focus:border-[#F8A201] transition-all text-sm text-center tracking-[0.35em]"
                />
              </div>

              <button
                type="submit"
                disabled={verifyLoading || otp.length !== 6}
                className="w-full py-3 px-4 bg-[#F8A201] text-[#130D08] font-bold text-sm rounded-lg hover:bg-[#e09200] transition-colors shadow-md shadow-[#F8A201]/10 active:scale-[0.98] disabled:opacity-50"
              >
                {verifyLoading ? 'Verifying...' : 'Verify & Login'}
              </button>
            </form>
          )}

          <p className="text-center text-xs text-gray-400 mt-6">
            Don't have an account?{' '}
            <Link to="/signup" className="text-[#F8A201] hover:underline font-medium">
              Sign up
            </Link>
          </p>

          {activeVerificationEmail && (
            <div className="mt-4 text-center text-xs text-gray-400">
              Need a new OTP for {activeVerificationEmail}?{' '}
              <button
                type="button"
                onClick={handleResend}
                disabled={resendLoading}
                className="text-[#F8A201] hover:underline font-medium disabled:opacity-50"
              >
                {resendLoading ? 'Sending...' : 'Resend OTP'}
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between pt-6 border-t border-white/5 text-[11px] text-gray-500 gap-2">
          <span>© 2026 Fointer</span>
          <div className="flex space-x-4">
            <Link to="/terms-and-conditions" className="hover:text-gray-300 transition-colors">Terms</Link>
            <Link to="/privacy-policy" className="hover:text-gray-300 transition-colors">Privacy</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
