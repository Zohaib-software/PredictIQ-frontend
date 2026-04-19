import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as yup from 'yup';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Alert } from '../components/Alert';
import styles from './AuthPage.module.css';

const initialForm = { businessName: '', email: '', phoneNumber: '', password: '', confirmPassword: '' };
const registerSchema = yup.object({
  businessName: yup
    .string()
    .trim()
    .required('Business name is required')
    .min(2, 'Business name must be at least 2 characters')
    .max(50, 'Business name must be less than 50 characters'),
  email: yup.string().trim().required('Email is required').email('Please enter a valid email'),
  phoneNumber: yup
    .string()
    .trim()
    .test(
      'valid-optional-phone',
      'Please enter a valid phone number',
      (value) => !value || /^\+?[0-9\s\-()]{7,20}$/.test(value)
    ),
  password: yup
    .string()
    .required('Password is required')
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must be less than 72 characters')
    .matches(/\d/, 'Password must contain at least one number'),
  confirmPassword: yup
    .string()
    .required('Please confirm your password')
    .oneOf([yup.ref('password')], 'Passwords must match'),
});

export function RegisterPage() {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
    if (apiError) setApiError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError('');
    try {
      await registerSchema.validate(form, { abortEarly: false });
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
      await register(
        form.businessName.trim(),
        form.email.trim().toLowerCase(),
        form.phoneNumber.trim() || undefined,
        form.password
      );
      navigate('/', { replace: true });
    } catch (err) {
      setApiError(err.message || 'Registration failed');
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
        <button
          type="button"
          className={styles.backButton}
          onClick={() => navigate(-1)}
        >
          <span aria-hidden="true">←</span>
          Back
        </button>
        <h1 className={styles.title}>Create account</h1>
        <p className={styles.subtitle}>
          Start forecasting with PredictIQ. Enter your business details below.
        </p>
        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          {apiError && (
            <Alert variant="error" className={styles.alert}>
              {apiError}
            </Alert>
          )}
          <Input
            label="Business name"
            name="businessName"
            type="text"
            autoComplete="organization"
            value={form.businessName}
            onChange={handleChange}
            error={errors.businessName}
            required
            disabled={submitting}
            placeholder="Your company or business name"
          />
          <Input
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={handleChange}
            error={errors.email}
            required
            disabled={submitting}
          />
          <Input
            label="Phone number"
            name="phoneNumber"
            type="tel"
            autoComplete="tel"
            value={form.phoneNumber}
            onChange={handleChange}
            error={errors.phoneNumber}
            disabled={submitting}
            placeholder="Optional"
          />
          <Input
            label="Password"
            name="password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={handleChange}
            error={errors.password}
            required
            disabled={submitting}
            placeholder="At least 8 characters"
          />
          <Input
            label="Confirm password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={handleChange}
            error={errors.confirmPassword}
            required
            disabled={submitting}
            placeholder="Re-enter your password"
          />
          <Button type="submit" fullWidth disabled={submitting}>
            {submitting ? 'Creating account…' : 'Create account'}
          </Button>
        </form>
        <p className={styles.footer}>
          Already have an account?{' '}
          <Link to="/login" className={styles.link}>
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
