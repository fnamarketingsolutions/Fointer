import React, { useEffect, useState } from 'react';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import { Navigate, useNavigate } from 'react-router-dom';
import { adminLogin } from '../../../api/auth';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../shared/components/feedback/ToastContext';
import BrandLogo from '../../../shared/components/BrandLogo';
import ThemeToggle from '../../../shared/components/ThemeToggle';
import SocialAuthButtons from './SocialAuthButtons';
import { useAdminSocialAuth } from '../hooks/useAdminSocialAuth';

export default function AdminLogin() {
  const navigate = useNavigate();
  const { user, loading, loginSuccess } = useAuth();
  const { showToast } = useToast();
  const {
    loading: socialLoading,
    error: socialError,
    setError: setSocialError,
    handleGoogleCredential,
    handleFacebookAuth,
  } = useAdminSocialAuth();

  const [formData, setFormData] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      navigate('/users', { replace: true });
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    if (socialError) showToast(socialError);
  }, [socialError, showToast]);

  if (!loading && user) {
    return <Navigate to="/users" replace />;
  }

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setEmailLoading(true);
    setSocialError('');

    try {
      const response = await adminLogin(formData);
      if (response?.success && response.user) {
        const ok = loginSuccess(response.user);
        if (!ok) {
          showToast('This portal is for administrators only.');
          return;
        }
        navigate('/users', { replace: true });
      } else {
        showToast(response?.message || 'Invalid email or password.');
      }
    } catch (error) {
      showToast(
        error?.response?.data?.message || 'Login failed. Please try again.'
      );
    } finally {
      setEmailLoading(false);
    }
  };

  return (
    <div className="auth-page relative min-h-screen w-full flex flex-col md:flex-row font-sans overflow-x-hidden">
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      <div
        className="auth-hero relative md:w-1/2 w-full min-h-[320px] md:min-h-screen flex flex-col justify-between p-8 md:p-14 bg-cover bg-center overflow-hidden"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(19, 13, 8, 0.7), rgba(19, 13, 8, 0.88)), url('https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?q=80&w=1200&auto=format&fit=crop')`,
        }}
      >
        <div>
          <BrandLogo to={null} />
          <h1 className="auth-hero-title text-4xl md:text-5xl font-serif leading-tight mt-6">
            Fointer
            <br />
            <span className="italic font-normal">Admin</span>
          </h1>
        </div>

        <p className="auth-hero-lead text-sm md:text-base max-w-md leading-relaxed font-light mt-10 md:mt-0">
          Secure access for platform administrators only. Member accounts cannot
          sign in here.
        </p>
      </div>

      <div className="md:w-1/2 w-full flex flex-col justify-between p-8 md:p-14">
        <div className="max-w-md w-full mx-auto my-auto py-8">
          <div className="mb-8">
            <h2 className="text-3xl font-serif text-fo-text">Admin sign in</h2>
            <p className="text-xs text-fo-subtle mt-2">
              Use email/password or a linked Google / Facebook account. There is
              no self-serve account creation on this portal.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-fo-muted uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="admin@fointer.com"
                required
                autoComplete="username"
                className="w-full px-4 py-3 rounded-lg bg-fo-surface-hover border border-fo-border/60 text-fo-text placeholder:text-fo-subtle focus:outline-none focus:border-fo-brand transition-all text-sm"
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
                  autoComplete="current-password"
                  className="w-full px-4 py-3 rounded-lg bg-fo-surface-hover border border-fo-border/60 text-fo-text placeholder:text-fo-subtle focus:outline-none focus:border-fo-brand transition-all text-sm pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-fo-subtle hover:text-fo-brand transition-colors"
                >
                  {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
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
                  {emailLoading ? 'Signing in...' : 'Sign in'}
                </button>
              }
              onGoogleCredential={handleGoogleCredential}
              onFacebookClick={handleFacebookAuth}
              googleLoading={socialLoading.google}
              facebookLoading={socialLoading.facebook}
            />
          </form>
        </div>

        <div className="pt-6 border-t border-fo-border text-[11px] text-fo-subtle text-center">
          © {new Date().getFullYear()} Fointer Admin
        </div>
      </div>
    </div>
  );
}
