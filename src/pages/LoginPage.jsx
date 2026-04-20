import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import * as yup from 'yup';
import { useAuth } from '../context/AuthContext';
import { requestPasswordResetEmail, verifyPasswordReset2fa } from '../api/authApi';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Alert } from '../components/Alert';
import { GoogleAuthButton, isGoogleAuthConfigured } from '../components/auth/GoogleAuthButton';
import styles from './AuthPage.module.css';

const initialForm = { identifier: '', password: '' };
const initialTwoFactorForm = { code: '' };
const initialResetForm = { email: '', code: '', newPassword: '', confirmPassword: '' };
const initialEmailOnlyForm = { email: '' };

const loginSchema = yup.object({
  identifier: yup.string().trim().required('Email or phone number is required'),
  password: yup.string().required('Password is required').min(6, 'Password must be at least 6 characters'),
});
const twoFactorSchema = yup.object({
  code: yup.string().trim().required('Authentication code is required'),
});
const verify2faResetSchema = yup.object({
  email: yup.string().trim().required('Email is required').email('Enter a valid email address'),
  code: yup.string().trim().required('Authentication code is required'),
});
const complete2faResetSchema = yup.object({
  newPassword: yup
    .string()
    .required('New password is required')
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must be at most 72 characters'),
  confirmPassword: yup
    .string()
    .required('Confirm your new password')
    .oneOf([yup.ref('newPassword')], 'Passwords must match'),
});
const requestEmailResetSchema = yup.object({
  email: yup.string().trim().required('Email is required').email('Enter a valid email address'),
});
const TWO_FACTOR_MAX_ATTEMPTS = 5;
const TWO_FACTOR_LOCK_MS = 30_000;

const mapTwoFactorError = (err) => {
  switch (err?.errorCode) {
    case 'two_factor_code_invalid_or_expired':
      return 'That code is invalid or expired. Try again or use a backup code.';
    case 'two_factor_token_invalid_or_expired':
      return 'Your 2FA session expired. Sign in again to request a new code challenge.';
    case 'two_factor_not_available':
      return 'Two-factor authentication is not available for this account right now. Sign in again.';
    default:
      return err?.message || 'Two-factor verification failed';
  }
};

export function LoginPage() {
  const [form, setForm] = useState(initialForm);
  const [twoFactorForm, setTwoFactorForm] = useState(initialTwoFactorForm);
  const [resetForm, setResetForm] = useState(initialResetForm);
  const [emailOnlyForm, setEmailOnlyForm] = useState(initialEmailOnlyForm);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [twoFactorChallenge, setTwoFactorChallenge] = useState(null);
  /** null | 'menu' | '2fa' | 'email' */
  const [resetSubView, setResetSubView] = useState(null);
  const [emailResetSent, setEmailResetSent] = useState(false);
  const [emailResetMessage, setEmailResetMessage] = useState('');
  const [reset2faVerificationToken, setReset2faVerificationToken] = useState(null);
  const [twoFactorFailures, setTwoFactorFailures] = useState(0);
  const [twoFactorLockedUntil, setTwoFactorLockedUntil] = useState(null);
  const { login, loginWithGoogle, verifyTwoFactorLogin, completePasswordReset2fa } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const pending = location.state?.googleTwoFactorPending;
    if (pending?.twoFactorToken) {
      setTwoFactorChallenge({
        twoFactorToken: pending.twoFactorToken,
        identifier: pending.identifier || '',
      });
      setTwoFactorForm(initialTwoFactorForm);
      setErrors({});
      setApiError('');
      setTwoFactorFailures(0);
      setTwoFactorLockedUntil(null);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.pathname, location.state, navigate]);

  const handleGoogleSuccess = async (credential) => {
    setApiError('');
    setSubmitting(true);
    try {
      const result = await loginWithGoogle(credential);
      if (result?.requiresTwoFactor) {
        setTwoFactorChallenge({
          twoFactorToken: result.twoFactorToken,
          identifier: result.identifier ?? '',
        });
        setTwoFactorForm(initialTwoFactorForm);
        setErrors({});
        setTwoFactorFailures(0);
        setTwoFactorLockedUntil(null);
        return;
      }
      navigate('/overview', { replace: true });
    } catch (err) {
      setApiError(err.message || 'Google sign-in failed');
    } finally {
      setSubmitting(false);
    }
  };
  const isTwoFactorStep = useMemo(() => Boolean(twoFactorChallenge?.twoFactorToken), [twoFactorChallenge]);
  const showForgotFlow = Boolean(resetSubView);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
    if (apiError) setApiError('');
  };

  const handleTwoFactorChange = (e) => {
    const { name, value } = e.target;
    setTwoFactorForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
    if (apiError) setApiError('');
  };

  const handleResetChange = (e) => {
    const { name, value } = e.target;
    setResetForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
    if (apiError) setApiError('');
  };

  const handleEmailOnlyChange = (e) => {
    const { name, value } = e.target;
    setEmailOnlyForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
    if (apiError) setApiError('');
  };

  const validateStep = async (schema, values) => {
    try {
      await schema.validate(values, { abortEarly: false });
      setErrors({});
      return true;
    } catch (err) {
      const byField = {};
      if (err.inner?.length) {
        err.inner.forEach((issue) => {
          if (issue.path && !byField[issue.path]) byField[issue.path] = issue.message;
        });
      } else if (err.path) {
        byField[err.path] = err.message;
      }
      setErrors(byField);
      return false;
    }
  };

  const handleSubmitLoginOrTwoFactor = async (e) => {
    e.preventDefault();
    setApiError('');
    if (isTwoFactorStep && twoFactorLockedUntil && Date.now() < twoFactorLockedUntil) {
      const waitSeconds = Math.max(1, Math.ceil((twoFactorLockedUntil - Date.now()) / 1000));
      setApiError(`Too many attempts. Try again in ${waitSeconds}s.`);
      return;
    }
    const isValid = await validateStep(isTwoFactorStep ? twoFactorSchema : loginSchema, isTwoFactorStep ? twoFactorForm : form);
    if (!isValid) return;
    setSubmitting(true);
    try {
      if (isTwoFactorStep) {
        await verifyTwoFactorLogin(twoFactorChallenge.twoFactorToken, twoFactorForm.code.trim());
        setTwoFactorFailures(0);
        setTwoFactorLockedUntil(null);
        navigate('/overview', { replace: true });
        return;
      }

      const identifier = form.identifier.trim();
      const result = await login(identifier.includes('@') ? identifier.toLowerCase() : identifier, form.password);

      if (result?.requiresTwoFactor) {
        setTwoFactorChallenge({
          twoFactorToken: result.twoFactorToken,
          identifier: result.identifier ?? identifier,
        });
        setTwoFactorForm(initialTwoFactorForm);
        setErrors({});
        setTwoFactorFailures(0);
        setTwoFactorLockedUntil(null);
        return;
      }

      navigate('/overview', { replace: true });
    } catch (err) {
      if (isTwoFactorStep) {
        const nextFailures = twoFactorFailures + 1;
        setTwoFactorFailures(nextFailures);
        if (nextFailures >= TWO_FACTOR_MAX_ATTEMPTS) {
          setTwoFactorFailures(0);
          setTwoFactorLockedUntil(Date.now() + TWO_FACTOR_LOCK_MS);
          setApiError('Too many failed attempts. Wait 30 seconds and try again.');
        } else {
          setApiError(mapTwoFactorError(err));
        }
      } else {
        setApiError(err.message || 'Login failed');
      }
      if (!isTwoFactorStep && err.errors?.length) {
        const byField = {};
        err.errors.forEach(({ field, message }) => { byField[field] = message; });
        setErrors(byField);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handle2faResetFormSubmit = async (e) => {
    e.preventDefault();
    setApiError('');
    if (!reset2faVerificationToken) {
      const isValid = await validateStep(verify2faResetSchema, {
        email: resetForm.email,
        code: resetForm.code,
      });
      if (!isValid) return;
      setSubmitting(true);
      try {
        const { verificationToken } = await verifyPasswordReset2fa({
          email: resetForm.email.trim().toLowerCase(),
          code: resetForm.code.trim(),
        });
        setReset2faVerificationToken(verificationToken);
        setErrors({});
      } catch (err) {
        setApiError(err.message || 'Verification failed');
        if (err.errors?.length) {
          const byField = {};
          err.errors.forEach(({ field, message }) => { byField[field] = message; });
          setErrors(byField);
        }
      } finally {
        setSubmitting(false);
      }
      return;
    }

    const isValid = await validateStep(complete2faResetSchema, {
      newPassword: resetForm.newPassword,
      confirmPassword: resetForm.confirmPassword,
    });
    if (!isValid) return;
    setSubmitting(true);
    try {
      await completePasswordReset2fa(reset2faVerificationToken, resetForm.newPassword);
      navigate('/overview', { replace: true });
    } catch (err) {
      setApiError(err.message || 'Password reset failed');
      if (err.errors?.length) {
        const byField = {};
        err.errors.forEach(({ field, message }) => { byField[field] = message; });
        setErrors(byField);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitEmailResetRequest = async (e) => {
    e.preventDefault();
    setApiError('');
    const isValid = await validateStep(requestEmailResetSchema, emailOnlyForm);
    if (!isValid) return;
    setSubmitting(true);
    try {
      const { message } = await requestPasswordResetEmail({ email: emailOnlyForm.email.trim().toLowerCase() });
      setEmailResetMessage(message || 'Check your inbox for the next steps.');
      setEmailResetSent(true);
    } catch (err) {
      setApiError(err.message || 'Could not send reset email');
      if (err.errors?.length) {
        const byField = {};
        err.errors.forEach(({ field, message }) => { byField[field] = message; });
        setErrors(byField);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleBackToSignIn = () => {
    if (resetSubView === '2fa' && reset2faVerificationToken) {
      setReset2faVerificationToken(null);
      setResetForm((prev) => ({ ...prev, newPassword: '', confirmPassword: '' }));
      setErrors({});
      setApiError('');
      return;
    }
    if (resetSubView === 'menu' || !resetSubView) {
      setResetSubView(null);
      setTwoFactorChallenge(null);
      setTwoFactorForm(initialTwoFactorForm);
      setTwoFactorFailures(0);
      setTwoFactorLockedUntil(null);
      setResetForm(initialResetForm);
      setReset2faVerificationToken(null);
      setEmailOnlyForm(initialEmailOnlyForm);
      setEmailResetSent(false);
      setEmailResetMessage('');
      setErrors({});
      setApiError('');
      return;
    }
    setResetSubView('menu');
    setEmailResetSent(false);
    setEmailResetMessage('');
    setResetForm(initialResetForm);
    setReset2faVerificationToken(null);
    setEmailOnlyForm(initialEmailOnlyForm);
    setErrors({});
    setApiError('');
  };

  const openPasswordReset = () => {
    setResetSubView('menu');
    setReset2faVerificationToken(null);
    setEmailResetSent(false);
    setEmailResetMessage('');
    setApiError('');
    setErrors({});
  };

  const title = isTwoFactorStep
    ? 'Verify your sign-in'
    : showForgotFlow
      ? resetSubView === 'menu'
        ? 'Reset your password'
        : resetSubView === 'email'
          ? 'Reset with email'
          : reset2faVerificationToken
            ? 'Choose a new password'
            : 'Reset with authenticator'
      : 'Log in';

  const subtitle = isTwoFactorStep
    ? `Enter the 6-digit code from your authenticator app or one of your backup codes for ${twoFactorChallenge?.identifier}.`
    : showForgotFlow
      ? resetSubView === 'menu'
        ? 'Choose how to verify your account. If you use two-factor authentication, resetting with your authenticator is quickest. Otherwise we can email you a secure link.'
        : resetSubView === 'email'
          ? 'We will send a one-time link to your email address if it matches an account.'
          : reset2faVerificationToken
            ? 'Your authenticator code was verified. Enter and confirm your new password below.'
            : 'Enter your account email and a code from your authenticator app (or a backup code). After verification, you can choose a new password. Two-factor authentication must already be enabled on your account.'
      : 'Sign in to your PredictIQ account to access your forecasts.';

  const showBack = isTwoFactorStep || showForgotFlow;

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        {showBack && (
          <button type="button" className={styles.backButton} onClick={handleBackToSignIn}>
            <span aria-hidden="true">←</span>
            {resetSubView === '2fa' && reset2faVerificationToken
              ? 'Back to code'
              : resetSubView && resetSubView !== 'menu'
                ? 'Choose another method'
                : 'Back to sign in'}
          </button>
        )}
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.subtitle}>{subtitle}</p>

        {apiError && (
          <Alert variant="error" className={styles.alert}>
            {apiError}
          </Alert>
        )}

        {showForgotFlow && resetSubView === 'menu' && (
          <div className={`${styles.form} ${styles.resetMethodStack}`}>
            <Button
              type="button"
              variant="primary"
              fullWidth
              disabled={submitting}
              onClick={() => {
                setReset2faVerificationToken(null);
                setResetForm(initialResetForm);
                setResetSubView('2fa');
              }}
            >
              Reset with authenticator app
            </Button>
            <Button
              type="button"
              variant="outline"
              fullWidth
              disabled={submitting}
              onClick={() => setResetSubView('email')}
            >
              Email me a reset link
            </Button>
          </div>
        )}

        {showForgotFlow && resetSubView === 'email' && (
          <form onSubmit={handleSubmitEmailResetRequest} className={styles.form} noValidate>
            {emailResetSent && (
              <Alert variant="success" className={styles.alert} role="status">
                {emailResetMessage}
              </Alert>
            )}
            {!emailResetSent && (
              <Input
                label="Email"
                name="email"
                type="email"
                autoComplete="email"
                value={emailOnlyForm.email}
                onChange={handleEmailOnlyChange}
                error={errors.email}
                required
                disabled={submitting}
                placeholder="you@example.com"
              />
            )}
            <Button type="submit" fullWidth disabled={submitting || emailResetSent}>
              {submitting ? 'Sending…' : emailResetSent ? 'Email sent' : 'Send reset link'}
            </Button>
          </form>
        )}

        {showForgotFlow && resetSubView === '2fa' && (
          <form onSubmit={handle2faResetFormSubmit} className={styles.form} noValidate>
            {!reset2faVerificationToken && (
              <>
                <Input
                  label="Email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={resetForm.email}
                  onChange={handleResetChange}
                  error={errors.email}
                  required
                  disabled={submitting}
                  placeholder="you@example.com"
                />
                <Input
                  label="Authenticator code"
                  name="code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={resetForm.code}
                  onChange={handleResetChange}
                  error={errors.code}
                  required
                  disabled={submitting}
                  placeholder="6-digit code or backup code"
                />
              </>
            )}
            {reset2faVerificationToken && (
              <>
                <Input
                  label="New password"
                  name="newPassword"
                  type="password"
                  autoComplete="new-password"
                  value={resetForm.newPassword}
                  onChange={handleResetChange}
                  error={errors.newPassword}
                  required
                  disabled={submitting}
                />
                <Input
                  label="Confirm new password"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={resetForm.confirmPassword}
                  onChange={handleResetChange}
                  error={errors.confirmPassword}
                  required
                  disabled={submitting}
                />
              </>
            )}
            <Button
              type="submit"
              fullWidth
              disabled={submitting || (isTwoFactorStep && twoFactorLockedUntil && Date.now() < twoFactorLockedUntil)}
            >
              {submitting
                ? reset2faVerificationToken
                  ? 'Resetting…'
                  : 'Verifying…'
                : reset2faVerificationToken
                  ? 'Reset password and sign in'
                  : 'Verify code'}
            </Button>
          </form>
        )}

        {!showForgotFlow && !isTwoFactorStep && isGoogleAuthConfigured() && (
          <div className={styles.oauthBlock}>
            <GoogleAuthButton
              onSuccess={handleGoogleSuccess}
              onError={() => setApiError('Google sign-in was cancelled or failed')}
              disabled={submitting}
            />
            <div className={styles.oauthDivider}>
              <span>or continue with email</span>
            </div>
          </div>
        )}

        {!showForgotFlow && (
          <form onSubmit={handleSubmitLoginOrTwoFactor} className={styles.form} noValidate>
            {isTwoFactorStep ? (
              <Input
                label="Authentication code"
                name="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={twoFactorForm.code}
                onChange={handleTwoFactorChange}
                error={errors.code}
                required
                disabled={submitting}
                placeholder="Enter 6-digit code or backup code"
              />
            ) : (
              <>
                <Input
                  label="Email / number"
                  name="identifier"
                  type="text"
                  autoComplete="username"
                  value={form.identifier}
                  onChange={handleChange}
                  error={errors.identifier}
                  required
                  disabled={submitting}
                  placeholder="Enter your email or phone number"
                />
                <Input
                  label="Password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={form.password}
                  onChange={handleChange}
                  error={errors.password}
                  required
                  disabled={submitting}
                />
              </>
            )}
            <Button type="submit" fullWidth disabled={submitting}>
              {submitting
                ? isTwoFactorStep
                  ? 'Verifying…'
                  : 'Signing in…'
                : isTwoFactorStep
                  ? 'Verify code'
                  : 'Sign in'}
            </Button>
          </form>
        )}

        {!isTwoFactorStep && !showForgotFlow && (
          <>
            <p className={styles.inlineLink}>
              <button type="button" className={styles.textButton} onClick={openPasswordReset}>
                Forgot password?
              </button>
            </p>
            <p className={styles.footer}>
              Don’t have an account?{' '}
              <Link to="/register" className={styles.link}>
                Create one
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
