import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import * as yup from 'yup';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Alert } from '../components/Alert';
import styles from './AuthPage.module.css';

const initialForm = { newPassword: '', confirmPassword: '' };

const schema = yup.object({
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

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get('token')?.trim() || '', [searchParams]);
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { completePasswordResetEmail } = useAuth();
  const navigate = useNavigate();
  const hasToken = token.length >= 20;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
    if (apiError) setApiError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError('');
    if (!hasToken) {
      return;
    }
    try {
      await schema.validate(form, { abortEarly: false });
      setErrors({});
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
      return;
    }

    setSubmitting(true);
    try {
      await completePasswordResetEmail(token, form.newPassword);
      navigate('/overview', { replace: true });
    } catch (err) {
      setApiError(err.message || 'Could not reset password');
      if (err.errors?.length) {
        const byField = {};
        err.errors.forEach(({ field, message }) => { byField[field] = message; });
        setErrors(byField);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <h1 className={styles.title}>Choose a new password</h1>
        <p className={styles.subtitle}>
          Enter a new password for your account. After saving, you will be signed in automatically.
        </p>
        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          {apiError && (
            <Alert variant="error" className={styles.alert}>
              {apiError}
            </Alert>
          )}
          {!hasToken && (
            <Alert variant="error" className={styles.alert}>
              This page needs a valid reset link from your email.{' '}
              <Link to="/login" className={styles.link}>
                Go to login
              </Link>
            </Alert>
          )}
          <Input
            label="New password"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            value={form.newPassword}
            onChange={handleChange}
            error={errors.newPassword}
            required
            disabled={submitting || !hasToken}
          />
          <Input
            label="Confirm new password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={handleChange}
            error={errors.confirmPassword}
            required
            disabled={submitting || !hasToken}
          />
          <Button type="submit" fullWidth disabled={submitting || !hasToken}>
            {submitting ? 'Saving…' : 'Save password and sign in'}
          </Button>
        </form>
        <p className={styles.footer}>
          <Link to="/login" className={styles.link}>
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
