import { useLayoutEffect, useRef, useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import styles from './GoogleAuthButton.module.css';

const hasClientId = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);

/** True when `VITE_GOOGLE_CLIENT_ID` is set (required for the Google button to render). */
export function isGoogleAuthConfigured() {
  return hasClientId;
}

/**
 * Renders Google's sign-in control; parent must be inside `GoogleOAuthProvider` when env is set.
 */
export function GoogleAuthButton({ onSuccess, onError, disabled }) {
  const containerRef = useRef(null);
  const [width, setWidth] = useState(360);

  useLayoutEffect(() => {
    if (!hasClientId) return undefined;
    const el = containerRef.current;
    if (!el) return undefined;
    const measure = () => {
      const w = Math.floor(el.getBoundingClientRect().width);
      setWidth(Math.min(400, Math.max(280, w || 320)));
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (ro) ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  if (!hasClientId) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={`${styles.wrap}${disabled ? ` ${styles.disabled}` : ''}`}
      aria-busy={disabled}
    >
      <GoogleLogin
        onSuccess={(cred) => {
          if (cred?.credential) onSuccess(cred.credential);
          else onError?.();
        }}
        onError={() => onError?.()}
        useOneTap={false}
        theme="outline"
        size="large"
        text="continue_with"
        shape="rectangular"
        width={width}
        locale="en"
      />
    </div>
  );
}
