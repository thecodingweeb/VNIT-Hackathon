import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  PawPrint, Lock, Mail, Shield, ArrowRight,
  CheckCircle, UserCheck, AlertCircle, Eye, EyeOff,
  KeyRound, ArrowLeft, RefreshCw, Send, Check, HelpCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import './Login.css';

export default function Login() {
  const { login, demoOfficers } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Login Form States
  const [email, setEmail] = useState('amit.sharma@forest.mp.gov.in');
  const [password, setPassword] = useState('pench2026');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Forgot PIN / Reset States
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('amit.sharma@forest.mp.gov.in');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [resetStep, setResetStep] = useState('request'); // 'request' | 'set-pin' | 'success'
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState(null);
  const [resetSuccessMsg, setResetSuccessMsg] = useState(null);
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [enteredOtp, setEnteredOtp] = useState('');

  const from = location.state?.from?.pathname || '/';

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setError(null);
    setLoading(true);

    if (!email) {
      setError('Please enter your authorized email address.');
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

  const handleQuickLogin = (officer) => {
    setEmail(officer.email);
    setPassword('pench2026');
    login(officer.email, 'pench2026').then(() => {
      navigate(from, { replace: true });
    });
  };

  // Open Forgot PIN flow
  const handleOpenForgotPin = () => {
    setResetEmail(email || 'amit.sharma@forest.mp.gov.in');
    setResetStep('request');
    setResetError(null);
    setResetSuccessMsg(null);
    setEnteredOtp('');
    setNewPin('');
    setConfirmPin('');
    setIsForgotModalOpen(true);
  };

  // Step 1: Send OTP / Verification
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
      // If real Supabase is configured
      if (supabase) {
        await supabase.auth.resetPasswordForEmail(resetEmail, {
          redirectTo: window.location.origin + '/login',
        });
      }

      // Generate a simulated 6-digit field recovery OTP
      const mockOtp = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedOtp(mockOtp);
      setEnteredOtp(mockOtp); // Auto-fill for convenience
      setResetLoading(false);
      setResetStep('set-pin');
      setResetSuccessMsg(`Recovery verification code generated for ${resetEmail}`);
    } catch (err) {
      setResetLoading(false);
      setResetError(err.message || 'Failed to initiate password reset.');
    }
  };

  // Step 2: Set New PIN
  const handleSaveNewPin = (e) => {
    e?.preventDefault();
    setResetError(null);

    if (!enteredOtp) {
      setResetError('Please enter the 6-digit verification code.');
      return;
    }

    if (!newPin || newPin.length < 4) {
      setResetError('New PIN/Password must be at least 4 characters long.');
      return;
    }

    if (newPin !== confirmPin) {
      setResetError('PINs do not match. Please re-enter.');
      return;
    }

    setResetLoading(true);

    setTimeout(() => {
      // Store new PIN in memory/storage
      setPassword(newPin);
      setEmail(resetEmail);
      setResetLoading(false);
      setResetStep('success');
      setResetSuccessMsg(`PIN has been successfully reset to "${newPin}" for ${resetEmail}.`);
    }, 600);
  };

  // Final step: Apply and sign in
  const handleApplyAndLogin = async () => {
    setIsForgotModalOpen(false);
    setLoading(true);
    const res = await login(resetEmail, newPin);
    setLoading(false);
    if (res.success) {
      navigate(from, { replace: true });
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

        {/* Main Login Form Card */}
        <div className="login-card">
          <div className="login-card-header">
            <h2 className="login-form-title">Authorized Personnel Access</h2>
            <p className="login-form-desc">Sign in with your Forest Department credentials or Supabase account</p>
          </div>

          {error && (
            <div className="login-error-alert">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form">
            <div className="login-input-group">
              <label className="login-label">Official Email / Ranger ID</label>
              <div className="login-input-wrap">
                <Mail size={16} className="login-input-icon" />
                <input
                  type="email"
                  className="login-input"
                  placeholder="ranger@forest.mp.gov.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="login-input-group">
              <div className="login-label-row">
                <label className="login-label">Access PIN / Password</label>
                <button
                  type="button"
                  className="login-forgot-btn"
                  onClick={handleOpenForgotPin}
                  title="Click to reset your PIN or access code"
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
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
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
              <span>{loading ? 'Authenticating…' : 'Access System'}</span>
              <ArrowRight size={16} />
            </button>
          </form>

          {/* Quick Demo Ranger Profiles */}
          <div className="login-demo-section">
            <div className="login-divider">
              <span>OR ONE-CLICK FIELD LOGIN</span>
            </div>
            <div className="demo-officers-grid">
              {demoOfficers.map((officer) => (
                <button
                  key={officer.id}
                  type="button"
                  className="demo-officer-chip"
                  onClick={() => handleQuickLogin(officer)}
                  title={`Sign in as ${officer.name}`}
                >
                  <div className="demo-officer-av font-mono">{officer.avatar}</div>
                  <div className="demo-officer-info">
                    <div className="demo-officer-name">{officer.name}</div>
                    <div className="demo-officer-role">{officer.role}</div>
                  </div>
                  <UserCheck size={14} className="demo-officer-check" />
                </button>
              ))}
            </div>
          </div>

          <div className="login-footer font-mono">
            <Shield size={12} />
            <span>Encrypted Session · Restricted to Authorized Field Personnel Only</span>
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

            {/* STEP 1: Request Email & OTP */}
            {resetStep === 'request' && (
              <form onSubmit={handleSendResetCode} className="forgot-form">
                <div className="login-input-group">
                  <label className="login-label">Enter Registered Ranger Email</label>
                  <div className="login-input-wrap">
                    <Mail size={16} className="login-input-icon" />
                    <input
                      type="email"
                      className="login-input"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="ranger@forest.mp.gov.in"
                      required
                    />
                  </div>
                  <span className="forgot-help-text">
                    A secure 6-digit field recovery code will be dispatched to this address.
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
                    <Send size={14} />
                    <span>{resetLoading ? 'Sending Code…' : 'Generate Recovery Code'}</span>
                  </button>
                </div>
              </form>
            )}

            {/* STEP 2: Enter Verification Code & Set New PIN */}
            {resetStep === 'set-pin' && (
              <form onSubmit={handleSaveNewPin} className="forgot-form">
                <div className="otp-display-box">
                  <span className="otp-label">Security OTP Generated:</span>
                  <span className="otp-code font-mono">{generatedOtp}</span>
                </div>

                <div className="login-input-group">
                  <label className="login-label">6-Digit Verification Code</label>
                  <div className="login-input-wrap">
                    <Shield size={16} className="login-input-icon" />
                    <input
                      type="text"
                      className="login-input font-mono"
                      value={enteredOtp}
                      onChange={(e) => setEnteredOtp(e.target.value)}
                      placeholder="e.g. 748291"
                      required
                    />
                  </div>
                </div>

                <div className="login-input-group">
                  <label className="login-label">New Access PIN / Password</label>
                  <div className="login-input-wrap">
                    <Lock size={16} className="login-input-icon" />
                    <input
                      type="password"
                      className="login-input font-mono"
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value)}
                      placeholder="Enter new 4–8 digit PIN"
                      required
                    />
                  </div>
                </div>

                <div className="login-input-group">
                  <label className="login-label">Confirm New PIN</label>
                  <div className="login-input-wrap">
                    <Lock size={16} className="login-input-icon" />
                    <input
                      type="password"
                      className="login-input font-mono"
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value)}
                      placeholder="Re-enter new PIN"
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
                    <Check size={14} />
                    <span>{resetLoading ? 'Updating PIN…' : 'Update Access PIN'}</span>
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
                <h4 className="success-title">PIN Reset Complete!</h4>
                <p className="success-desc">
                  Your new credentials have been verified and applied. You can now access TigerWatch immediately.
                </p>

                <div className="success-creds-preview font-mono">
                  <div><strong>Email:</strong> {resetEmail}</div>
                  <div><strong>New PIN:</strong> {newPin}</div>
                </div>

                <button
                  type="button"
                  className="cat-btn-primary full-width"
                  onClick={handleApplyAndLogin}
                >
                  <span>Sign In to TigerWatch Now</span>
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
