import React, { useState } from 'react';
import { registerApi } from '../services/api';

export const RegisterPage = ({ onRegisterSuccess, onNavigateLogin, onNavigateHome }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errorMessage) setErrorMessage('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const { name, email, password, confirmPassword } = formData;

    // Client-side validations
    if (!name.trim() || !email.trim() || !password || !confirmPassword) {
      setErrorMessage('Please complete all registration fields.');
      return;
    }

    if (name.trim().length < 2) {
      setErrorMessage('Full name must be at least 2 characters long.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please verify.');
      return;
    }

    setLoading(true);

    try {
      const result = await registerApi({
        name: name.trim(),
        email: email.trim(),
        password
      });

      if (result.success) {
        setSuccessMessage('Registration successful! Redirecting...');
        setTimeout(() => {
          onRegisterSuccess(result.data.user);
        }, 1200);
      } else {
        setErrorMessage(result.error || 'Registration failed. Please try again.');
      }
    } catch (err) {
      setErrorMessage(err.message || 'An unexpected error occurred during registration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-container">
      <div className="auth-card">
        {/* Header */}
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
          <h2 className="auth-title">Citizen Registration</h2>
          <p className="auth-subtitle">
            Join your municipal community network to report hazards and track infrastructure resolutions
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

        {/* Success Alert */}
        {successMessage && (
          <div className="alert-box alert-success">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span>{successMessage}</span>
          </div>
        )}

        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="register-name">
              Full Name
            </label>
            <input
              id="register-name"
              type="text"
              name="name"
              className="form-input"
              placeholder="e.g. Jane Doe"
              value={formData.name}
              onChange={handleChange}
              disabled={loading}
              autoComplete="name"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="register-email">
              Email Address
            </label>
            <input
              id="register-email"
              type="email"
              name="email"
              className="form-input"
              placeholder="e.g. jane.doe@example.com"
              value={formData.email}
              onChange={handleChange}
              disabled={loading}
              autoComplete="email"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="register-password">
              Password <span className="label-hint">(Minimum 8 characters)</span>
            </label>
            <input
              id="register-password"
              type="password"
              name="password"
              className="form-input"
              placeholder="Create a strong password"
              value={formData.password}
              onChange={handleChange}
              disabled={loading}
              autoComplete="new-password"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="register-confirm">
              Confirm Password
            </label>
            <input
              id="register-confirm"
              type="password"
              name="confirmPassword"
              className="form-input"
              placeholder="Re-enter your password"
              value={formData.confirmPassword}
              onChange={handleChange}
              disabled={loading}
              autoComplete="new-password"
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary full-width btn-large"
            disabled={loading}
          >
            {loading ? 'Creating Citizen Account...' : 'Complete Citizen Registration'}
          </button>
        </form>

        {/* Footer Navigation */}
        <div className="auth-footer">
          <p className="auth-switch-text">
            Already have an account?{' '}
            <button
              type="button"
              className="link-button"
              onClick={onNavigateLogin}
            >
              Sign In Here
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

export default RegisterPage;
