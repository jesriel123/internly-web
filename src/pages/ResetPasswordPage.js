import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseConfig';
import './ResetPasswordPage.css';

function extractRecoveryPayload(url) {
  if (!url) return {};

  const raw = String(url);
  const hashIndex = raw.indexOf('#');
  const queryIndex = raw.indexOf('?');
  const hashString = hashIndex >= 0 ? raw.slice(hashIndex + 1) : '';
  const queryString = queryIndex >= 0 ? raw.slice(queryIndex + 1, hashIndex >= 0 ? hashIndex : undefined) : '';

  const hashParams = new URLSearchParams(hashString);
  const queryParams = new URLSearchParams(queryString);
  const merged = new URLSearchParams();

  hashParams.forEach((value, key) => merged.set(key, value));
  queryParams.forEach((value, key) => {
    if (!merged.has(key)) merged.set(key, value);
  });

  return {
    accessToken: merged.get('access_token'),
    refreshToken: merged.get('refresh_token'),
    authCode: merged.get('code'),
    tokenHash: merged.get('token_hash'),
    token: merged.get('token'),
    type: merged.get('type') || 'recovery',
    email: merged.get('email'),
    error: merged.get('error'),
    errorDescription: merged.get('error_description'),
  };
}

async function bindRecoverySession(payload) {
  if (payload.error) {
    throw new Error(payload.errorDescription || payload.error);
  }

  if (payload.accessToken && payload.refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: payload.accessToken,
      refresh_token: payload.refreshToken,
    });
    if (error) throw error;
    return;
  }

  if (payload.authCode) {
    const { error } = await supabase.auth.exchangeCodeForSession(payload.authCode);
    if (error) throw error;
    return;
  }

  const otpType = payload.type || 'recovery';

  if (payload.tokenHash) {
    const verifyInput = {
      type: otpType,
      token_hash: payload.tokenHash,
    };

    if (payload.email) {
      verifyInput.email = payload.email;
    }

    const { error } = await supabase.auth.verifyOtp(verifyInput);
    if (error) throw error;
    return;
  }

  if (payload.token && payload.email) {
    const { error } = await supabase.auth.verifyOtp({
      type: otpType,
      token: payload.token,
      email: payload.email,
    });
    if (error) throw error;
    return;
  }

  throw new Error('Missing recovery token in reset link. Please request a new one.');
}

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let mounted = true;

    const ensureRecoverySession = async () => {
      try {
        const payload = extractRecoveryPayload(window.location.href);
        const hasPayload =
          payload.accessToken ||
          payload.refreshToken ||
          payload.authCode ||
          payload.tokenHash ||
          payload.token ||
          payload.error;

        if (hasPayload) {
          await bindRecoverySession(payload);
          if (!mounted) return;
          setReady(true);
          setError('');
          window.history.replaceState({}, document.title, window.location.pathname);
          return;
        }

        const { data } = await supabase.auth.getSession();
        if (!mounted) return;

        if (!data?.session?.user) {
          setReady(false);
          setError('This reset link is invalid or expired. Please request a new one.');
        } else {
          setReady(true);
        }
      } catch (err) {
        if (mounted) {
          setReady(false);
          setError(err?.message || 'Unable to validate reset link. Please request a new one.');
        }
      } finally {
        if (mounted) setChecking(false);
      }
    };

    ensureRecoverySession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setReady(true);
        setError('');
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (!ready) {
      setError('Reset link is not ready. Please open the reset email link again.');
      setSuccess('');
      return;
    }

    if (!newPassword || !confirmPassword) {
      setError('Please complete both password fields.');
      setSuccess('');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      setSuccess('');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      setSuccess('');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.user) {
        throw new Error('This reset link is invalid or expired. Please request a new one.');
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;

      setSuccess('Password updated successfully. Redirecting to login...');
      setTimeout(async () => {
        await supabase.auth.signOut().catch(() => {});
        navigate('/login', { replace: true });
      }, 1200);
    } catch (err) {
      setError(err?.message || 'Unable to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="reset-page">
      <div className="reset-card">
        <h1>Reset Password</h1>
        <p>Create a new password for your account.</p>

        {error && <div className="reset-error">{error}</div>}
        {success && <div className="reset-success">{success}</div>}

        <form onSubmit={handleSubmit} className="reset-form">
          <label htmlFor="new-password">New Password</label>
          <input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Enter new password"
            disabled={checking || loading}
            autoComplete="new-password"
            required
          />

          <label htmlFor="confirm-password">Confirm Password</label>
          <input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            disabled={checking || loading}
            autoComplete="new-password"
            required
          />

          <button type="submit" disabled={checking || loading}>
            {checking ? 'Validating link...' : loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>

        <Link to="/login" className="reset-back-link">
          Back to Login
        </Link>
      </div>
    </div>
  );
}
