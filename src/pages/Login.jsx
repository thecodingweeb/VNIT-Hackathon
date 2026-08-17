import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  PawPrint, Lock, Mail, Shield, ArrowRight,
  CheckCircle, UserCheck, AlertCircle, Eye, EyeOff,
  KeyRound, ArrowLeft, UserPlus, LogIn, User
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import './Login.css';

export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Mode: 'login' | 'register'
  const [authMode, setAuthMode] = useState('login');

  // Login Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Register Form States
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState('RANGE_OFFICER');

  // Forgot PIN / Reset States
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [resetStep, setResetStep] = useState('request'); // 'request' | 'set-pin' | 'success'
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState(null);
  const [resetSuccessMsg, setResetSuccessMsg] = useState(null);

  const from = location.state?.from?.pathname || '/';

  // Handle Login Submit
  const handleLoginSubmit = async (e) => {
    e?.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    if (!email || !password) {
      setError('Please enter both your official email and access password.');
      setLoading(false);
      return;
    }

    const res = await login(email, password);
    setLoading(false);
    if (res.success) {
      navigate(from, { replace: true });
    } else {
      setError(res.error || 'Authentication failed. Please check credentials.');
    }
  };

  // Handle Register Submit
  const handleRegisterSubmit = async (e) => {
    e?.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    if (!regEmail || !regPassword || !regName) {
      setError('Please fill in all registration fields.');
      setLoading(false);
      return;
    }

    if (regPassword.length < 6) {
      setError('Password / PIN must be at least 6 characters.');
      setLoading(false);
      return;
    }

    const res = await register({
      email: regEmail,
      password: regPassword,
      fullName: regName,
      role: regRole,
    });

    setLoading(false);
    if (res.success) {
      if (res.session) {
        navigate(from, { replace: true });
      } else {
        setSuccessMsg('Account created successfully! You can now sign in with your credentials.');
        setEmail(regEmail);
        setAuthMode('login');
      }
    } else {
      setError(res.error || 'Failed to register officer profile.');
    }
  };

  // Open Forgot PIN flow
  const handleOpenForgotPin = () => {
    setResetEmail(email || '');
    setResetStep('request');
    setResetError(null);
    setResetSuccessMsg(null);
    setNewPin('');
    setConfirmPin('');
    setIsForgotModalOpen(true);
  };

  // Step 1: Send Reset Instructions
  const handleSendResetCode = async (e) => {
    e?.preventDefault();
    setResetError(null);
    setResetLoading(true);

    if (!resetEmail) {
      setResetError('Please enter your official email address.');
      setResetLoading(false);
      return;
    }

    try {
      if (supabase) {
        const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
          redirectTo: window.location.origin + '/login',
        });
        if (error) throw error;
      }

      setResetLoading(false);
      setResetStep('set-pin');
      setResetSuccessMsg(`Password reset instructions dispatched to ${resetEmail}`);
    } catch (err) {
      setResetLoading(false);
      setResetError(err.message || 'Failed to initiate password reset.');
    }
  };

  // Step 2: Set New PIN
  const handleSaveNewPin = async (e) => {
    e?.preventDefault();
    setResetError(null);

    if (!newPin || newPin.length < 6) {
      setResetError('New password/PIN must be at least 6 characters long.');
      return;
    }

    if (newPin !== confirmPin) {
      setResetError('Passwords do not match. Please re-enter.');
      return;
    }

    setResetLoading(true);

    try {
      if (supabase) {
        const { error } = await supabase.auth.updateUser({ password: newPin });
        if (error) throw error;
      }

      setResetLoading(false);
      setResetStep('success');
      setResetSuccessMsg(`Password has been updated for ${resetEmail}.`);
    } catch (err) {
      setResetLoading(false);
      setResetError(err.message || 'Failed to update password.');
    }
  };

  return (
    <div className="login-page">
      {/* Background Ambience */}
      <div className="login-backdrop-image" />
      <div className="login-overlay-glow" />

      <div className="login-card-container">
        {/* Brand & Seal */}
        <div className="login-brand">
          <div className="login-logo-icon">
            <PawPrint size={28} />
          </div>
          <h1 className="login-app-title">TigerWatch</h1>
          <p className="login-app-sub">Movement Intelligence & Spatial Monitoring System</p>
          <div className="login-reserve-badge font-mono">
            <span>PENCH TIGER RESERVE · STATE FOREST DEPT</span>
          </div>
        </div>

        {/* Main Card */}
        <div className="login-card">
          {/* Mode Switcher Tabs */}
          <div className="login-mode-tabs">
            <button
              type="button"
              className={`login-mode-tab ${authMode === 'login' ? 'login-mode-tab--active' : ''}`}
              onClick={() => { setAuthMode('login'); setError(null); setSuccessMsg(null); }}
            >
              <LogIn size={15} />
              <span>Officer Sign In</span>
            </button>
            <button
              type="button"
              className={`login-mode-tab ${authMode === 'register' ? 'login-mode-tab--active' : ''}`}
              onClick={() => { setAuthMode('register'); setError(null); setSuccessMsg(null); }}
            >
              <UserPlus size={15} />
              <span>Enroll Personnel</span>
            </button>
          </div>

          <div className="login-card-header">
            <h2 className="login-form-title">
              {authMode === 'login' ? 'Authorized Personnel Access' : 'Register New Field Personnel'}
            </h2>
            <p className="login-form-desc">
              {authMode === 'login'
                ? 'Sign in with your official Forest Department ID & secure password'
                : 'Create an authorized officer profile linked to Pench Tiger Reserve'
              }
            </p>
          </div>

          {error && (
            <div className="login-error-alert">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="forgot-success-alert" style={{ marginBottom: '16px' }}>
              <CheckCircle size={16} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* SIGN IN FORM */}
          {authMode === 'login' ? (
            <form onSubmit={handleLoginSubmit} className="login-form">
              <div className="login-input-group">
                <label className="login-label">Official Email / Officer ID</label>
                <div className="login-input-wrap">
                  <Mail size={16} className="login-input-icon" />
                  <input
                    type="email"
                    className="login-input"
                    placeholder="e.g. officer@forest.mp.gov.in"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="username"
                  />
                </div>
              </div>

              <div className="login-input-group">
                <div className="login-label-row">
                  <label className="login-label">Access Password / PIN</label>
                  <button
                    type="button"
                    className="login-forgot-btn"
                    onClick={handleOpenForgotPin}
                    title="Click to reset your password"
                  >
                    <KeyRound size={12} />
                    <span>Forgot PIN?</span>
                  </button>
                </div>
                <div className="login-input-wrap">
                  <Lock size={16} className="login-input-icon" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="login-input font-mono"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="login-pwd-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <button type="submit" className="login-submit-btn" disabled={loading}>
                <span>{loading ? 'Authenticating…' : 'Access Secure System'}</span>
                <ArrowRight size={16} />
              </button>
            </form>
          ) : (
            /* ENROLL / REGISTER FORM */
            <form onSubmit={handleRegisterSubmit} className="login-form">
              <div className="login-input-group">
                <label className="login-label">Full Name & Title</label>
                <div className="login-input-wrap">
                  <User size={16} className="login-input-icon" />
                  <input
                    type="text"
                    className="login-input"
                    placeholder="e.g. Ranger Rajesh Verma"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="login-input-group">
                <label className="login-label">Official Email</label>
                <div className="login-input-wrap">
                  <Mail size={16} className="login-input-icon" />
                  <input
                    type="email"
                    className="login-input"
                    placeholder="e.g. rajesh.verma@forest.mp.gov.in"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="login-input-group">
                <label className="login-label">Designation / Role</label>
                <div className="login-input-wrap">
                  <select
                    className="login-input"
                    value={regRole}
                    onChange={(e) => setRegRole(e.target.value)}
                    style={{ cursor: 'pointer' }}
                  >
                    <option value="RANGE_OFFICER">Range Officer / Patrol Lead</option>
                    <option value="BIOLOGIST">Wildlife Biologist / Re-ID Specialist</option>
                    <option value="FIELD_STAFF">Field Staff / Camera Trap Unit</option>
                    <option value="ADMIN">Chief Wildlife Warden (Admin)</option>
                  </select>
                </div>
              </div>

              <div className="login-input-group">
                <label className="login-label">Create Access Password / PIN</label>
                <div className="login-input-wrap">
                  <Lock size={16} className="login-input-icon" />
                  <input
                    type="password"
                    className="login-input font-mono"
                    placeholder="Minimum 6 characters"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button type="submit" className="login-submit-btn" disabled={loading}>
                <span>{loading ? 'Registering…' : 'Register Authorized Officer'}</span>
                <UserCheck size={16} />
              </button>
            </form>
          )}

          <div className="login-footer font-mono">
            <Shield size={12} />
            <span>Strict Role-Based Access Control · Pench Surveillance Network</span>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          FORGOT PIN / PASSWORD RECOVERY MODAL
         ══════════════════════════════════════════════════════════════════ */}
      {isForgotModalOpen && (
        <div className="forgot-modal-backdrop">
          <div className="forgot-modal-card">
            <div className="forgot-modal-header">
              <div className="forgot-modal-icon">
                <KeyRound size={22} />
              </div>
              <div>
                <h3 className="forgot-modal-title">Access PIN Recovery</h3>
                <p className="forgot-modal-subtitle">Pench Tiger Reserve Security & Authentication Service</p>
              </div>
            </div>

            {resetError && (
              <div className="login-error-alert" style={{ marginBottom: '12px' }}>
                <AlertCircle size={15} />
                <span>{resetError}</span>
              </div>
            )}

            {resetSuccessMsg && (
              <div className="forgot-success-alert">
                <CheckCircle size={15} />
                <span>{resetSuccessMsg}</span>
              </div>
            )}

            {/* STEP 1: Request Email */}
            {resetStep === 'request' && (
              <form onSubmit={handleSendResetCode} className="forgot-form">
                <div className="login-input-group">
                  <label className="login-label">Enter Registered Email</label>
                  <div className="login-input-wrap">
                    <Mail size={16} className="login-input-icon" />
                    <input
                      type="email"
                      className="login-input"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="officer@forest.mp.gov.in"
                      required
                    />
                  </div>
                  <span className="forgot-help-text">
                    A secure password reset confirmation will be dispatched to this address.
                  </span>
                </div>

                <div className="forgot-actions-row">
                  <button
                    type="button"
                    className="cat-btn-secondary"
                    onClick={() => setIsForgotModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="cat-btn-primary"
                    disabled={resetLoading}
                  >
                    <span>{resetLoading ? 'Dispatching…' : 'Send Reset Link'}</span>
                  </button>
                </div>
              </form>
            )}

            {/* STEP 2: Set New PIN */}
            {resetStep === 'set-pin' && (
              <form onSubmit={handleSaveNewPin} className="forgot-form">
                <div className="login-input-group">
                  <label className="login-label">New Access Password / PIN</label>
                  <div className="login-input-wrap">
                    <Lock size={16} className="login-input-icon" />
                    <input
                      type="password"
                      className="login-input font-mono"
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value)}
                      placeholder="Enter new password (min 6 chars)"
                      required
                    />
                  </div>
                </div>

                <div className="login-input-group">
                  <label className="login-label">Confirm New Password / PIN</label>
                  <div className="login-input-wrap">
                    <Lock size={16} className="login-input-icon" />
                    <input
                      type="password"
                      className="login-input font-mono"
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value)}
                      placeholder="Re-enter new password"
                      required
                    />
                  </div>
                </div>

                <div className="forgot-actions-row">
                  <button
                    type="button"
                    className="cat-btn-secondary"
                    onClick={() => setResetStep('request')}
                  >
                    <ArrowLeft size={14} /> Back
                  </button>
                  <button
                    type="submit"
                    className="cat-btn-primary"
                    disabled={resetLoading}
                  >
                    <span>{resetLoading ? 'Updating…' : 'Update Password'}</span>
                  </button>
                </div>
              </form>
            )}

            {/* STEP 3: Success Confirmation */}
            {resetStep === 'success' && (
              <div className="forgot-success-view">
                <div className="success-icon-wrap">
                  <CheckCircle size={36} color="var(--color-success)" />
                </div>
                <h4 className="success-title">Password Reset Complete!</h4>
                <p className="success-desc">
                  Your credentials have been updated. You can now sign in with your new password.
                </p>

                <button
                  type="button"
                  className="cat-btn-primary full-width"
                  onClick={() => setIsForgotModalOpen(false)}
                >
                  <span>Return to Sign In</span>
                  <ArrowRight size={15} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
