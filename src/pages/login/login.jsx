import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './login.css';

function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);

    const { error: loginError } = await login(email, password);

    setLoading(false);

    if (loginError) {
      // Provide a friendly message instead of exposing the raw Supabase error
      setError('Invalid email or password. Please try again.');
      return;
    }

    // Successful login — navigate to the Interface Selector
    navigate('/');
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-brand-icon">
            <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#FFFFFF">
              <path d="M380.5-480.5Q340-521 340-580t40.5-99.5Q421-720 480-720t99.5 40.5Q620-639 620-580t-40.5 99.5Q539-440 480-440t-99.5-40.5ZM523-537q17-17 17-43t-17-43q-17-17-43-17t-43 17q-17 17-17 43t17 43q17 17 43 17t43-17ZM480-80q-139-35-229.5-159.5T160-516v-244l320-120 320 120v244q0 152-90.5 276.5T480-80Zm0-400Zm0-315-240 90v189q0 54 15 105t41 96q42-21 88-33t96-12q50 0 96 12t88 33q26-45 41-96t15-105v-189l-240-90Zm-70 523q-34 8-65 22 29 30 63 52t72 34q38-12 72-34t63-52q-31-14-65-22t-70-8q-36 0-70 8Z"/>
            </svg>
          </div>
          <div>
            <div className="login-subtitle">SECURE TERMINAL ACCESS</div>
            <h1>Servio POS</h1>
          </div>
        </div>

        <p className="login-description">
          Sign in with your staff credentials to access the system.
        </p>

        {/* Inline error banner */}
        {error && (
          <div
            style={{
              background: '#fef2f2',
              border: '1px solid #fca5a5',
              borderRadius: 8,
              padding: '10px 14px',
              marginBottom: 12,
              fontSize: '0.85rem',
              color: '#dc2626',
            }}
          >
            {error}
          </div>
        )}

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="login-label">
            Email Address
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="staff@servio.com"
              required
              autoComplete="email"
              disabled={loading}
            />
          </label>

          <label className="login-label password-label">
            Password
            <div className="password-field">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                disabled={loading}
              />
              <button
                type="button"
                className="show-password"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
              >
                {showPassword ? '🙈' : '👁'}
              </button>
            </div>
          </label>

          <button
            type="submit"
            className="login-submit"
            disabled={loading}
            style={{ opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'Signing in…' : 'Sign In →'}
          </button>
        </form>

        <div className="login-meta-row">
          <span className="login-meta-status">TERMINAL ID: POS-X14</span>
          <span className="login-meta-version">V2.5.0-STABLE</span>
        </div>
      </div>
    </div>
  );
}

export default Login;