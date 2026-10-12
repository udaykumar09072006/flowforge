import React, { useState, useEffect } from 'react';
import {
  Workflow as WorkflowIcon,
  Mail,
  Lock,
  User,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  ShieldCheck,
  Sparkles,
  RefreshCw,
  Eye,
  EyeOff,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export type AuthMode = 'login' | 'signup' | 'forgot' | 'reset' | 'verify';

interface AuthPageProps {
  initialMode?: AuthMode;
  initialToken?: string;
  onSuccess?: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({
  initialMode = 'login',
  initialToken = '',
  onSuccess,
}) => {
  const { login, signup, forgotPassword, resetPassword, verifyEmail, quickDemoLogin } = useAuth();

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState(initialToken);
  const [verifyToken, setVerifyToken] = useState(initialToken);

  // Status & Feedback states
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [debugToken, setDebugToken] = useState<string | null>(null);

  // Check URL query parameters for reset/verify tokens
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get('token');
    if (tokenParam) {
      if (window.location.pathname.includes('reset') || mode === 'reset') {
        setResetToken(tokenParam);
        setMode('reset');
      } else if (window.location.pathname.includes('verify') || mode === 'verify') {
        setVerifyToken(tokenParam);
        setMode('verify');
      }
    }
  }, [mode]);

  // Reset errors when changing modes
  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setErrorMessage(null);
    setSuccessMessage(null);
    setDebugToken(null);
  };

  // Password strength checks for sign up
  const hasMinLength = password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  // Handle Login Submit
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    setIsLoading(true);
    const res = await login(email, password);
    setIsLoading(false);

    if (!res.success) {
      setErrorMessage(res.error || 'Invalid email or password.');
    } else {
      onSuccess?.();
    }
  };

  // Handle Sign Up Submit
  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!name.trim()) {
      setErrorMessage('Full name is required.');
      return;
    }
    if (!email.trim()) {
      setErrorMessage('Work email is required.');
      return;
    }
    if (!hasMinLength || !hasLetter || !hasNumber) {
      setErrorMessage('Password must be at least 8 characters and contain both letters and numbers.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    const res = await signup(name, email, password, confirmPassword);
    setIsLoading(false);

    if (!res.success) {
      setErrorMessage(res.error || 'Failed to create account.');
    } else {
      if (res.verificationToken) {
        setDebugToken(res.verificationToken);
      }
      setSuccessMessage('Account created successfully! Welcome to FlowForge.');
      setTimeout(() => {
        onSuccess?.();
      }, 1200);
    }
  };

  // Handle Forgot Password Submit
  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email.trim()) {
      setErrorMessage('Please enter your account email.');
      return;
    }

    setIsLoading(true);
    const res = await forgotPassword(email);
    setIsLoading(false);

    setSuccessMessage(res.message);
    if (res.debugResetToken) {
      setDebugToken(res.debugResetToken);
      setResetToken(res.debugResetToken);
    }
  };

  // Handle Reset Password Submit
  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!resetToken.trim()) {
      setErrorMessage('Password reset token is required.');
      return;
    }
    if (!hasMinLength || !hasLetter || !hasNumber) {
      setErrorMessage('Password must be at least 8 characters and contain letters and numbers.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    const res = await resetPassword(resetToken, password, confirmPassword);
    setIsLoading(false);

    if (!res.success) {
      setErrorMessage(res.error || 'Failed to reset password.');
    } else {
      setSuccessMessage('Password reset successfully! Please log in with your new password.');
      setTimeout(() => {
        switchMode('login');
      }, 1500);
    }
  };

  // Handle Email Verification Submit
  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!verifyToken.trim()) {
      setErrorMessage('Verification token is required.');
      return;
    }

    setIsLoading(true);
    const res = await verifyEmail(verifyToken);
    setIsLoading(false);

    if (!res.success) {
      setErrorMessage(res.error || 'Invalid or expired verification token.');
    } else {
      setSuccessMessage('Email verified successfully! You now have full workspace permissions.');
      setTimeout(() => {
        onSuccess?.();
      }, 1200);
    }
  };

  // Handle Quick Demo Login
  const handleQuickDemo = async (demoEmail: string) => {
    setErrorMessage(null);
    setIsLoading(true);
    setEmail(demoEmail);
    setPassword('Password123!');
    const ok = await quickDemoLogin(demoEmail);
    setIsLoading(false);
    if (ok) {
      onSuccess?.();
    } else {
      setErrorMessage('Demo login failed.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 text-slate-100 flex flex-col justify-center items-center px-4 py-8 select-none relative overflow-hidden">
      {/* Background Ambient Glows */}
      <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Card */}
      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 backdrop-blur-xl rounded-2xl shadow-2xl p-6 sm:p-8 relative z-10 transition-all">
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25 mb-3 group hover:scale-105 transition-transform">
            <WorkflowIcon className="w-6 h-6 stroke-[2.2]" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            FlowForge
            <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 bg-indigo-500/20 text-indigo-300 rounded border border-indigo-500/30">
              SECURE
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 text-center">
            {mode === 'login' && 'Sign in to access your automation workspace'}
            {mode === 'signup' && 'Create your enterprise automation account'}
            {mode === 'forgot' && 'Reset your account password securely'}
            {mode === 'reset' && 'Create a new secure password'}
            {mode === 'verify' && 'Verify your email address'}
          </p>
        </div>

        {/* Global Notifications */}
        {errorMessage && (
          <div className="mb-5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5 animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            <div className="flex-1">{errorMessage}</div>
          </div>
        )}

        {successMessage && (
          <div className="mb-5 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-start gap-2.5 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
            <div className="flex-1">{successMessage}</div>
          </div>
        )}

        {/* Debug Token Helper for Testing (only shows after forgot/signup in test environment) */}
        {debugToken && (
          <div className="mb-5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold flex items-center gap-1.5 text-amber-200">
                <Sparkles className="w-3.5 h-3.5" /> Direct Testing Token Generated
              </span>
              <button
                type="button"
                onClick={() => {
                  if (mode === 'forgot') {
                    setResetToken(debugToken);
                    switchMode('reset');
                  } else {
                    setVerifyToken(debugToken);
                    switchMode('verify');
                  }
                }}
                className="text-[11px] underline hover:text-white cursor-pointer"
              >
                Use Token &rarr;
              </button>
            </div>
            <code className="bg-slate-950/70 p-1.5 rounded text-[11px] font-mono break-all text-amber-200/90 select-all border border-amber-500/20">
              {debugToken}
            </code>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* MODE: LOGIN */}
        {/* ------------------------------------------------------------------ */}
        {mode === 'login' && (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Work Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  required
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-950/60 border border-slate-700/80 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-slate-300">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => switchMode('forgot')}
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full pl-9 pr-9 py-2 text-sm bg-slate-950/60 border border-slate-700/80 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-600 text-white font-medium text-sm rounded-lg shadow-md shadow-indigo-600/30 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* Quick Demo Accounts */}
            <div className="pt-3 border-t border-slate-800">
              <p className="text-[11px] font-medium text-slate-400 mb-2 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                Quick-Sign In as Seeded Demo Roles:
              </p>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickDemo('alex@flowforge.dev')}
                  className="p-2 text-left bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 hover:border-indigo-500/50 rounded-lg transition-all text-xs cursor-pointer group"
                >
                  <div className="font-semibold text-slate-200 group-hover:text-indigo-300">Alex R.</div>
                  <div className="text-[10px] text-indigo-400">Owner</div>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickDemo('sarah.c@flowforge.dev')}
                  className="p-2 text-left bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 hover:border-indigo-500/50 rounded-lg transition-all text-xs cursor-pointer group"
                >
                  <div className="font-semibold text-slate-200 group-hover:text-indigo-300">Sarah C.</div>
                  <div className="text-[10px] text-amber-400">Admin</div>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickDemo('devon@flowforge.dev')}
                  className="p-2 text-left bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 hover:border-indigo-500/50 rounded-lg transition-all text-xs cursor-pointer group"
                >
                  <div className="font-semibold text-slate-200 group-hover:text-indigo-300">Devon P.</div>
                  <div className="text-[10px] text-emerald-400">Editor</div>
                </button>
              </div>
            </div>

            <div className="text-center pt-2">
              <span className="text-xs text-slate-400">Don't have an account? </span>
              <button
                type="button"
                onClick={() => switchMode('signup')}
                className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 cursor-pointer"
              >
                Sign Up
              </button>
            </div>
          </form>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* MODE: SIGN UP */}
        {/* ------------------------------------------------------------------ */}
        {mode === 'signup' && (
          <form onSubmit={handleSignUpSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Aarav Sharma"
                  required
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-950/60 border border-slate-700/80 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Work Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="aarav@company.com"
                  required
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-950/60 border border-slate-700/80 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  required
                  className="w-full pl-9 pr-9 py-2 text-sm bg-slate-950/60 border border-slate-700/80 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your password"
                  required
                  className="w-full pl-9 pr-9 py-2 text-sm bg-slate-950/60 border border-slate-700/80 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Password Validation Checklist */}
            <div className="bg-slate-950/50 p-2.5 rounded-lg border border-slate-800 space-y-1.5 text-[11px]">
              <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-emerald-400' : 'text-slate-500'}`}>
                <CheckCircle2 className={`w-3.5 h-3.5 ${hasMinLength ? 'text-emerald-400' : 'text-slate-600'}`} />
                <span>At least 8 characters</span>
              </div>
              <div className={`flex items-center gap-1.5 ${hasLetter ? 'text-emerald-400' : 'text-slate-500'}`}>
                <CheckCircle2 className={`w-3.5 h-3.5 ${hasLetter ? 'text-emerald-400' : 'text-slate-600'}`} />
                <span>Contains letters (a-z)</span>
              </div>
              <div className={`flex items-center gap-1.5 ${hasNumber ? 'text-emerald-400' : 'text-slate-500'}`}>
                <CheckCircle2 className={`w-3.5 h-3.5 ${hasNumber ? 'text-emerald-400' : 'text-slate-600'}`} />
                <span>Contains numbers (0-9)</span>
              </div>
              <div className={`flex items-center gap-1.5 ${passwordsMatch ? 'text-emerald-400' : 'text-slate-500'}`}>
                <CheckCircle2 className={`w-3.5 h-3.5 ${passwordsMatch ? 'text-emerald-400' : 'text-slate-600'}`} />
                <span>Passwords match</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !hasMinLength || !hasLetter || !hasNumber || !passwordsMatch}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-600 text-white font-medium text-sm rounded-lg shadow-md shadow-indigo-600/30 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="text-center pt-2">
              <span className="text-xs text-slate-400">Already registered? </span>
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 cursor-pointer"
              >
                Sign In
              </button>
            </div>
          </form>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* MODE: FORGOT PASSWORD */}
        {/* ------------------------------------------------------------------ */}
        {mode === 'forgot' && (
          <form onSubmit={handleForgotSubmit} className="space-y-4">
            <p className="text-xs text-slate-300 leading-relaxed">
              Enter the email address associated with your FlowForge account. We will dispatch instructions with a single-use token to reset your password.
            </p>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Account Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  required
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-950/60 border border-slate-700/80 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-600 text-white font-medium text-sm rounded-lg shadow-md shadow-indigo-600/30 focus:outline-none transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Dispatching Link...</span>
                </>
              ) : (
                <>
                  <span>Send Reset Instructions</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => switchMode('reset')}
                className="text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer"
              >
                Already have a reset token?
              </button>
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                Back to Sign In
              </button>
            </div>
          </form>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* MODE: RESET PASSWORD */}
        {/* ------------------------------------------------------------------ */}
        {mode === 'reset' && (
          <form onSubmit={handleResetSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Reset Token
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  placeholder="Paste single-use token"
                  required
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-950/60 border border-slate-700/80 rounded-lg text-slate-100 placeholder-slate-500 font-mono focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                New Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  required
                  className="w-full pl-9 pr-9 py-2 text-sm bg-slate-950/60 border border-slate-700/80 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Confirm New Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  required
                  className="w-full pl-9 pr-9 py-2 text-sm bg-slate-950/60 border border-slate-700/80 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !hasMinLength || !hasLetter || !hasNumber || !passwordsMatch}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-600 text-white font-medium text-sm rounded-lg shadow-md shadow-indigo-600/30 focus:outline-none transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Updating Password...</span>
                </>
              ) : (
                <>
                  <span>Save New Password</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                Back to Sign In
              </button>
            </div>
          </form>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* MODE: VERIFY EMAIL */}
        {/* ------------------------------------------------------------------ */}
        {mode === 'verify' && (
          <form onSubmit={handleVerifySubmit} className="space-y-4">
            <p className="text-xs text-slate-300 leading-relaxed">
              Paste your email verification token below to verify your account and enable all workspace permissions.
            </p>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Verification Token
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={verifyToken}
                  onChange={(e) => setVerifyToken(e.target.value)}
                  placeholder="Enter verification token"
                  required
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-950/60 border border-slate-700/80 rounded-lg text-slate-100 placeholder-slate-500 font-mono focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !verifyToken.trim()}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-600 text-white font-medium text-sm rounded-lg shadow-md shadow-emerald-600/30 focus:outline-none transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <span>Verify Email Address</span>
                  <CheckCircle2 className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                Back to Sign In
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Security Footer Notice */}
      <div className="mt-8 text-center text-xs text-slate-500 max-w-sm flex items-center justify-center gap-2">
        <ShieldCheck className="w-4 h-4 text-emerald-500" />
        <span>Enterprise Argon2id/bcrypt hashing &bull; HttpOnly SameSite cookies</span>
      </div>
    </div>
  );
};
