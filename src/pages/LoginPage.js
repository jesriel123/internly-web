import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { logButtonClick, logRequestStart, logRequestSuccess, logRequestFailure, logNetworkStatus } from '../utils/debugLogger';
import { Mail, Lock, Eye, EyeOff, Shield, Calendar, CheckSquare, Users } from 'lucide-react';
import './LoginPage.css';

const TITAN_LOGO_URL = '/titan-logo.png';

const PASSWORD_RESET_PROD_URL = 'https://internll-projects.vercel.app/reset-password';

function sanitizeHttpRedirectUrl(rawValue, fallback) {
  const cleaned = String(rawValue || '').trim();
  if (!cleaned) return fallback;

  try {
    const parsed = new URL(cleaned);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return fallback;
    }
    return parsed.toString();
  } catch {
    return fallback;
  }
}

function friendlyError(err) {
  const msg = ((err?.code || '') + ' ' + (err?.message || '')).toLowerCase();
  
  if (msg.includes('firebase')) {
    return 'Cannot reach database server. Please check your internet connection.';
  }
  if (msg.includes('access denied')) {
    return 'Access denied. Only Admin and Super Admin can log in.';
  }
  if (msg.includes('invalid-credential') || msg.includes('wrong-password') || msg.includes('user-not-found')) {
    return 'Invalid email or password.';
  }
  return err?.message || 'Login failed. Please try again.';
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const { login, forgotPassword } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    logButtonClick('WEB_LOGIN_BUTTON');
    setInfo('');
    setError('');
    setLoading(true);
    const start = logRequestStart('WEB_LOGIN');
    try {
      if (!navigator.onLine) throw new Error('No internet connection. Please check your network and try again.');
      
      await login(email.trim(), password);
      logRequestSuccess('WEB_LOGIN', start);
    } catch (err) {
      logRequestFailure('WEB_LOGIN', start, err);
      logNetworkStatus();
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (sendingReset || loading) return;
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail) {
      setInfo('');
      setError('Enter your email first to receive a reset link.');
      return;
    }

    setInfo('');
    setError('');
    setSendingReset(true);
    try {
      const redirectTo = sanitizeHttpRedirectUrl(
        process.env.REACT_APP_PASSWORD_RESET_REDIRECT,
        PASSWORD_RESET_PROD_URL
      );
      await forgotPassword(cleanEmail, redirectTo);
      setInfo('Password reset email sent. Check your inbox or spam folder.');
    } catch (err) {
      setError(err?.message || 'Failed to send reset email. Please try again.');
    } finally {
      setSendingReset(false);
    }
  };

  return (
    <div className="login-container">
      {/* Left Branding Panel */}
      <div className="login-left">
        <div className="left-content">
          <div className="brand-logo">
            <img src={TITAN_LOGO_URL} alt="Titan logo" className="logo-image" />
            <h2>Titan</h2>
          </div>
          
          <h1 className="hero-text">
            Your intern program,<br />organized.
          </h1>
          
          <p className="hero-subtext">
            Monitor attendance, approve logs,<br />
            and manage your team from one<br />
            clean dashboard.
          </p>
          
          <div className="features-list">
            <div className="feature-item">
              <div className="feature-icon"><Calendar size={20} color="#7B68EE" /></div>
              <span>Real-time attendance tracking</span>
            </div>
            <div className="feature-item">
              <div className="feature-icon"><CheckSquare size={20} color="#7B68EE" /></div>
              <span>One-click log approvals</span>
            </div>
            <div className="feature-item">
              <div className="feature-icon"><Users size={20} color="#7B68EE" /></div>
              <span>Multi-level admin roles</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Login Panel */}
      <div className="login-right">
        <div className="login-form-wrapper">
          <div className="secure-badge">
            <Shield size={16} /> <span>Secure sign in</span>
          </div>

          <h2 className="login-title">Welcome back</h2>
          <p className="login-subtitle">Sign in to access the admin portal.</p>

          <div className="role-info">
            <p className="role-info-label">Authorized roles</p>
            <div className="role-info-cards">
              <div className="role-info-card">
                <div className="role-info-icon">
                  <Shield size={20} />
                </div>
                <div className="role-info-content">
                  <h4>Super Admin</h4>
                  <p>Full system access</p>
                </div>
              </div>
              
              <div className="role-info-card">
                <div className="role-info-icon">
                  <Users size={20} />
                </div>
                <div className="role-info-content">
                  <h4>Admin</h4>
                  <p>Company management</p>
                </div>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            {info && <div className="login-info">{info}</div>}
            {error && <div className="login-error">{error}</div>}
            
            <div className="input-group">
              <label>EMAIL ADDRESS</label>
              <div className="input-wrapper">
                <Mail className="input-icon" size={20} />
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="input-group">
              <div className="label-row">
                <label>PASSWORD</label>
                <button
                  type="button"
                  className="forgot-pwd"
                  disabled={sendingReset || loading}
                  onClick={handleForgotPassword}
                >
                  {sendingReset ? 'Sending...' : 'Forgot password?'}
                </button>
              </div>
              <div className="input-wrapper">
                <Lock className="input-icon" size={20} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
                <button 
                  type="button" 
                  className="pwd-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <label className="checkbox-container">
              <input 
                type="checkbox" 
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span className="checkmark"></span>
              Remember me
            </label>

            <button type="submit" disabled={loading} className="submit-btn">
              {loading ? 'Signing in...' : 'Sign in \u2192'}
            </button>
          </form>


        </div>
      </div>
    </div>
  );
}
