import React, { useState } from 'react';
import { loginApi } from '../services/api';

export const LoginPage = ({ onLoginSuccess, onNavigateRegister, onNavigateHome }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errorMessage) setErrorMessage('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    // Client-side validations
    if (!formData.email.trim() || !formData.password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim())) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setLoading(true);

    try {
      const result = await loginApi({
        email: formData.email.trim(),
        password: formData.password
      });

      if (result.success) {
        onLoginSuccess(result.data.user);
      } else {
        setErrorMessage(result.error || 'Login failed. Please check your credentials.');
      }
    } catch (err) {
      setErrorMessage(err.message || 'An unexpected error occurred during login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-container">
      <div className="auth-card">
        {/* Brand Header */}
        <div className="auth-header">
          <div className="brand-icon-wrapper small" style={{ margin: '0 auto 0.75rem' }}>
            <svg
              className="brand-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <h2 className="auth-title">Citizen &amp; Official Sign In</h2>
          <p className="auth-subtitle">
            Access your CivicFix AI portal to manage and monitor public issues
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="alert-box alert-error">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">
              Email Address
            </label>
            <input
              id="login-email"
              type="email"
              name="email"
              className="form-input"
              placeholder="e.g. citizen@example.com"
              value={formData.email}
              onChange={handleChange}
              disabled={loading}
              autoComplete="email"
              required
            />
          </div>

          <div className="form-group">
            <div className="label-row">
              <label className="form-label" htmlFor="login-password">
                Password
              </label>
            </div>
            <input
              id="login-password"
              type="password"
              name="password"
              className="form-input"
              placeholder="Enter your password"
              value={formData.password}
              onChange={handleChange}
              disabled={loading}
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary full-width btn-large"
            disabled={loading}
          >
            {loading ? 'Authenticating...' : 'Sign In to CivicFix'}
          </button>
        </form>

        {/* Footer Navigation */}
        <div className="auth-footer">
          <p className="auth-switch-text">
            Don't have an account?{' '}
            <button
              type="button"
              className="link-button"
              onClick={onNavigateRegister}
            >
              Register as Citizen
            </button>
          </p>
          <button
            type="button"
            className="link-button back-link"
            onClick={onNavigateHome}
          >
            &larr; Back to Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
