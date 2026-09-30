import React, { useEffect, useMemo, useState } from 'react';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import {
  LuArrowLeft as ArrowLeft,
} from 'react-icons/lu';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { signupUser, resendVerificationEmail, verifyEmailOtp } from '../../../api/auth';
import { useAuth } from '../../../context/AuthContext';
import { useSocialAuth } from '../hooks/useSocialAuth';
import { useToast } from '../../../shared/components/feedback/ToastContext';
import SocialAuthButtons from './SocialAuthButtons';
import BrandLogo from '../../../shared/components/BrandLogo';
import ThemeToggle from '../../../shared/components/ThemeToggle';
import LocationFields from '../../../shared/components/LocationFields';
import InterestSuggestions from '../../../shared/components/InterestSuggestions';
import { dateOfBirthError } from '../../../shared/lib/dateOfBirth';
import { postalCodeError } from '../../../shared/lib/postalCode';
import { getPostAuthPath } from '../../../shared/lib/roles';
import {
  captureReferralCode,
  captureReferralFromLocation,
  clearStoredReferralCode,
  getStoredReferralCode,
  normalizeReferralCode,
} from '../../../shared/lib/referralCapture';

const STEPS = [
  { id: 'account', label: 'Account' },
  { id: 'profile', label: 'Profile' },
  { id: 'verify', label: 'Verify' },
];

export default function SignUp() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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

  const [step, setStep] = useState('account');
  const [formData, setFormData] = useState({
    username: '',
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    bio: '',
    gender: '',
    dateOfBirth: '',
    city: '',
    state: '',
    country: '',
    zipCode: '',
    address: '',
    referralCode: '',
  });
  const [interests, setInterests] = useState([]);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  const activeVerificationEmail = verificationEmail || pendingVerification?.email || '';

  useEffect(() => {
    const fromUrl = captureReferralFromLocation(searchParams.toString());
    const stored = fromUrl || getStoredReferralCode();
    if (stored) {
      setFormData((current) =>
        current.referralCode ? current : { ...current, referralCode: stored }
      );
    }
  }, [searchParams]);

  useEffect(() => {
    if (socialError) showToast(socialError);
  }, [socialError, showToast]);

  useEffect(() => {
    if (pendingVerification?.email) {
      setVerificationEmail(pendingVerification.email);
      setStep('verify');
    }
  }, [pendingVerification]);

  const stepIndex = useMemo(
    () => Math.max(0, STEPS.findIndex((item) => item.id === step)),
    [step]
  );

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'referralCode') {
      const cleaned = String(value || '')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 32);
      setFormData((current) => ({ ...current, referralCode: cleaned }));
      const normalized = normalizeReferralCode(cleaned);
      if (normalized) captureReferralCode(normalized);
      else clearStoredReferralCode();
      return;
    }
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const addInterest = (raw) => {
    const value = String(raw || '').trim();
    if (!value) return;
    setInterests((prev) => {
      if (prev.includes(value) || prev.length >= 20) return prev;
      return [...prev, value];
    });
    setInterestInput('');
  };

  const removeInterest = (tag) => {
    setInterests((prev) => prev.filter((item) => item !== tag));
  };

  const validateAccount = () => {
    if (!formData.username.trim() || !formData.name.trim() || !formData.email.trim()) {
      showToast('Please fill in all account fields.');
      return false;
    }
    if (formData.password.length < 8) {
      showToast('Password must be at least 8 characters.');
      return false;
    }
    if (
      !/[a-z]/.test(formData.password) ||
      !/[A-Z]/.test(formData.password) ||
      !/\d/.test(formData.password)
    ) {
      showToast(
        'Password must include uppercase, lowercase, and a number.'
      );
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      showToast('Passwords do not match.');
      return false;
    }
    return true;
  };

  const validateProfile = () => {
    if (!formData.gender) {
      showToast('Gender is required.');
      return false;
    }
    const dobError = dateOfBirthError(formData.dateOfBirth);
    if (dobError) {
      showToast(dobError);
      return false;
    }
    const postalError = postalCodeError(formData.zipCode);
    if (postalError) {
      showToast(postalError);
      return false;
    }
    return true;
  };

  const goToProfileStep = (e) => {
    e.preventDefault();
    if (!validateAccount()) return;
    setStep('profile');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateAccount()) {
      setStep('account');
      return;
    }
    if (!validateProfile()) return;

    setEmailLoading(true);
    setSocialError('');
    clearPendingVerification();

    try {
      const payload = {
        username: formData.username.trim(),
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password,
        confirmPassword: formData.confirmPassword,
        bio: formData.bio.trim(),
        interests,
        gender: formData.gender,
        dateOfBirth: formData.dateOfBirth,
        city: formData.city.trim(),
        state: formData.state.trim(),
        country: formData.country.trim(),
        zipCode: formData.zipCode.trim(),
        address: formData.address.trim(),
      };
      const referralCode =
        normalizeReferralCode(formData.referralCode) || getStoredReferralCode();
      if (referralCode) payload.referralCode = referralCode;
      const response = await signupUser(payload);
      if (response?.success) {
        clearStoredReferralCode();
        setVerificationEmail(response?.email || formData.email);
        setOtp('');
        setStep('verify');
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
        const ok = loginSuccess(response.user);
        if (!ok) {
          showToast('Admin accounts must sign in through the admin portal.');
          return;
        }
        navigate(getPostAuthPath(response));
      }
    } catch (error) {
      showToast(error?.response?.data?.message || 'OTP verification failed.');
    } finally {
      setVerifyLoading(false);
    }
  };

  const inputClass =
    'w-full px-4 py-3 rounded-lg bg-fo-surface-hover border border-fo-border text-fo-auth-fg placeholder-fo-auth-muted focus:outline-none focus:border-fo-brand transition-all text-sm';

  const stepTitle =
    step === 'account'
      ? 'Create an Account'
      : step === 'profile'
        ? 'Tell us about you'
        : 'Verify your email';

  const stepSubtitle =
    step === 'account'
      ? 'Enter your details to register and get started.'
      : step === 'profile'
        ? 'Gender and date of birth are required. A postal code fills in your country, state, and city.'
        : `Enter the 6-digit OTP sent to ${activeVerificationEmail}.`;

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
              onClick={() => {
                if (step === 'profile') setStep('account');
                else if (step === 'verify' && !pendingVerification) setStep('profile');
                else window.history.back();
              }}
              className="mb-4 inline-flex items-center text-xs font-medium text-fo-text hover:text-fo-brand transition-colors group cursor-pointer border-b border-fo-border hover:border-fo-brand pb-1 gap-1"
              aria-label="Go back"
            >
              <div className="transition-all">
                <ArrowLeft className="w-4 h-4 text-fo-text group-hover:text-fo-brand group-hover:-translate-x-0.5 transition-transform" />
              </div>
              <span className="tracking-wide text-fo-text group-hover:text-fo-brand transition-colors">
                {step === 'account' ? 'Go Back' : 'Back'}
              </span>
            </button>

            <div className="flex items-center gap-2 mb-5" aria-label="Signup progress">
              {STEPS.map((item, index) => {
                const active = index === stepIndex;
                const done = index < stepIndex;
                return (
                  <React.Fragment key={item.id}>
                    {index > 0 ? (
                      <div
                        className={`h-px flex-1 ${done || active ? 'bg-fo-brand/50' : 'bg-fo-border'}`}
                      />
                    ) : null}
                    <div className="flex flex-col items-center gap-1 min-w-[4.5rem]">
                      <span
                        className={`w-7 h-7 rounded-full text-[11px] font-semibold inline-flex items-center justify-center border ${
                          active
                            ? 'bg-fo-brand text-fo-brand-fg border-fo-brand'
                            : done
                              ? 'bg-fo-brand/15 text-fo-brand border-fo-brand/40'
                              : 'bg-fo-surface-hover text-fo-subtle border-fo-border'
                        }`}
                      >
                        {index + 1}
                      </span>
                      <span
                        className={`text-[10px] uppercase tracking-wide ${
                          active ? 'text-fo-text font-semibold' : 'text-fo-subtle'
                        }`}
                      >
                        {item.label}
                      </span>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>

            <h2 className="text-3xl font-serif text-fo-text">{stepTitle}</h2>
            <p className="text-xs text-fo-subtle mt-2">{stepSubtitle}</p>
          </div>

          {step === 'account' ? (
            <form onSubmit={goToProfileStep} className="space-y-4">
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
                    placeholder="Min 8 chars, upper, lower, number"
                    required
                    minLength={8}
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
                    placeholder="Confirm password"
                    required
                    minLength={8}
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

              <div>
                <label className="block text-xs font-medium text-fo-muted uppercase tracking-wider mb-1.5">
                  Referral code{' '}
                  <span className="normal-case tracking-normal text-fo-subtle">
                    (optional)
                  </span>
                </label>
                <input
                  type="text"
                  name="referralCode"
                  value={formData.referralCode}
                  onChange={handleChange}
                  placeholder="Enter a friend's invite code"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={32}
                  className={`${inputClass} uppercase tracking-wider`}
                />
                <p className="mt-1.5 text-[11px] text-fo-subtle">
                  Have an invite link or code? Paste the code here — or open their
                  link and it will fill in automatically.
                </p>
              </div>

              <SocialAuthButtons
                primarySlot={
                  <button
                    type="submit"
                    className="w-full py-3 px-4 bg-fo-brand text-fo-brand-fg font-bold text-sm rounded-lg hover:bg-fo-brand-hover transition-colors shadow-md shadow-fo-brand/10 active:scale-[0.98]"
                  >
                    Continue
                  </button>
                }
                onGoogleCredential={handleGoogleCredential}
                onFacebookClick={handleFacebookAuth}
                googleLoading={socialLoading.google}
                facebookLoading={socialLoading.facebook}
              />
            </form>
          ) : null}

          {step === 'profile' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-fo-muted uppercase tracking-wider mb-1.5">
                  Bio <span className="normal-case tracking-normal text-fo-subtle">(optional)</span>
                </label>
                <textarea
                  name="bio"
                  value={formData.bio}
                  onChange={handleChange}
                  rows={3}
                  maxLength={500}
                  placeholder="A short intro about yourself…"
                  className={`${inputClass} resize-y min-h-[88px]`}
                />
                <p className="mt-1 text-[11px] text-fo-subtle text-right">
                  {formData.bio.length}/500
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-fo-muted uppercase tracking-wider mb-1.5">
                  Interests <span className="normal-case tracking-normal text-fo-subtle">(optional)</span>
                </label>
                <InterestSuggestions
                  selected={interests}
                  onAdd={addInterest}
                  onRemove={removeInterest}
                  inputClass={inputClass}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-fo-muted uppercase tracking-wider mb-1.5">
                    Gender
                  </label>
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                    required
                    className={inputClass}
                  >
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-fo-muted uppercase tracking-wider mb-1.5">
                    Date of birth
                  </label>
                  <input
                    type="date"
                    name="dateOfBirth"
                    value={formData.dateOfBirth}
                    onChange={handleChange}
                    required
                    max={new Date().toISOString().slice(0, 10)}
                    min="1900-01-01"
                    className={inputClass}
                  />
                </div>
              </div>

              <LocationFields
                value={{
                  zipCode: formData.zipCode,
                  state: formData.state,
                  city: formData.city,
                  country: formData.country,
                  address: formData.address,
                }}
                onChange={(location) =>
                  setFormData((current) => ({ ...current, ...location }))
                }
                inputClass={inputClass}
                labelClass="block text-xs font-medium text-fo-muted uppercase tracking-wider mb-1.5"
              />

              <button
                type="submit"
                disabled={emailLoading}
                className="w-full py-3 px-4 bg-fo-brand text-fo-brand-fg font-bold text-sm rounded-lg hover:bg-fo-brand-hover transition-colors shadow-md shadow-fo-brand/10 active:scale-[0.98] disabled:opacity-50"
              >
                {emailLoading ? 'Creating account…' : 'Create account'}
              </button>
            </form>
          ) : null}

          {step === 'verify' ? (
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
          ) : null}

          <p className="text-center text-xs text-fo-subtle mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-fo-brand hover:underline font-medium">
              Log in
            </Link>
          </p>

          {step === 'verify' && activeVerificationEmail ? (
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
          ) : null}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between pt-6 border-t border-fo-border text-[11px] text-fo-subtle gap-2">
          <span>© 2026 Fointer</span>
          <div className="flex space-x-4">
            <Link to="/privacy-policy" className="hover:text-fo-muted transition-colors">Privacy</Link>
            <Link to="/terms-and-conditions" className="hover:text-fo-muted transition-colors">Terms</Link>
            <Link to="/user-delete" className="hover:text-fo-muted transition-colors">Delete account</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
