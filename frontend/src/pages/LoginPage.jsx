import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

export default function LoginPage() {
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/auth/login', {
        email,
        password,
      });

      login(response.data);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
        'Invalid email or password. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">

      {/* Background decoration */}
      <div className="login-bg-orb login-bg-orb-1" />
      <div className="login-bg-orb login-bg-orb-2" />
      <div className="login-dots login-dots-1" />
      <div className="login-dots login-dots-2" />

      <div className="login-shell">

        {/* =====================================================
            LEFT SIDE
        ===================================================== */}
        <section className="login-left">

          {/* Branding */}
          <div className="login-brand">

            <div className="login-brand-icon">
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 13v-2a8 8 0 0 1 16 0v2"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
                <path
                  d="M4 13a2 2 0 0 0 2 2h1v-5H6a2 2 0 0 0-2 2v1Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <path
                  d="M20 13a2 2 0 0 1-2 2h-1v-5h1a2 2 0 0 1 2 2v1Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <path
                  d="M17 17c-.8 1.3-2.1 2-3.6 2H12"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            <div>
              <div className="login-brand-name">
                Support<span>Hub</span>
              </div>

              <div className="login-brand-subtitle">
                Ticket Management System
              </div>
            </div>

          </div>


          {/* Hero text */}
          <div className="login-hero">

            <h1>
              Resolve faster.
              <br />
              Support <span>smarter.</span>
            </h1>

            <div className="hero-line" />

            <p>
              Track. Assign. Collaborate. Deliver.
            </p>

          </div>


          {/* =================================================
              ILLUSTRATION
          ================================================= */}
          <div className="support-illustration">

            {/* glowing circle */}
            <div className="illustration-glow" />

            {/* ticket 1 */}
            <div className="support-ticket ticket-1">
              <div className="ticket-inner">
                <span>◉</span>
              </div>
            </div>

            {/* ticket 2 */}
            <div className="support-ticket ticket-2">
              <div className="ticket-inner">
                <span>◉</span>
              </div>
            </div>

            {/* ticket 3 */}
            <div className="support-ticket ticket-3">
              <div className="ticket-inner">
                <span>◉</span>
              </div>
            </div>


            {/* Arrow paths */}
            <div className="flow-arrow arrow-1">→</div>
            <div className="flow-arrow arrow-2">→</div>
            <div className="flow-arrow arrow-3">→</div>


            {/* Agent 1 */}
            <div className="illustration-agent agent-a">

              <div className="agent-face">
                <div className="agent-hair" />
              </div>

              <div className="agent-shirt blue-shirt" />

              <div className="agent-laptop laptop-orange">
                <span>●</span>
              </div>

            </div>


            {/* Agent 2 */}
            <div className="illustration-agent agent-b">

              <div className="agent-face headset-face">
                <div className="agent-hair" />
                <div className="headset-band" />
              </div>

              <div className="agent-shirt dark-shirt" />

              <div className="agent-laptop laptop-red">
                <span>●</span>
              </div>

            </div>


            {/* Agent 3 */}
            <div className="illustration-agent agent-c">

              <div className="agent-face">
                <div className="agent-hair" />
              </div>

              <div className="agent-shirt blue-shirt" />

              <div className="agent-laptop laptop-pink">
                <span>●</span>
              </div>

            </div>

          </div>


          {/* Bottom feature */}
          <div className="reliable-card">

            <div className="reliable-icon">
              ✓
            </div>

            <div>
              <strong>
                Reliable <span>•</span> Secure <span>•</span> Efficient
              </strong>

              <p>
                Better support, happier users.
              </p>
            </div>

          </div>

        </section>


        {/* =====================================================
            RIGHT SIDE
        ===================================================== */}
        <section className="login-right">

          <div className="login-form-container">

            {/* Heading */}
            <div className="login-heading">

              <div className="welcome-text">
                Welcome Back <span>👋</span>
              </div>

              <h2>
                Sign in to your account
              </h2>

              <p>
                Access your dashboard and manage support tickets.
              </p>

            </div>


            {/* Form */}
            <form onSubmit={handleSubmit}>

              {/* Email */}
              <div className="login-field">

                <label htmlFor="email">
                  Email address
                </label>

                <div className="login-input-wrap">

                  <svg
                    className="field-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <rect
                      x="3"
                      y="5"
                      width="18"
                      height="14"
                      rx="2"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    />
                    <path
                      d="m3 7 9 6 9-6"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    />
                  </svg>

                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError('');
                    }}
                    placeholder="you@company.com"
                    autoComplete="email"
                    autoFocus
                    required
                  />

                </div>

              </div>


              {/* Password */}
              <div className="login-field">

                <div className="password-heading">

                  <label htmlFor="password">
                    Password
                  </label>

                  <button
                    type="button"
                    className="forgot-button"
                    onClick={() => {}}
                  >
                    Forgot password?
                  </button>

                </div>

                <div className="login-input-wrap">

                  <svg
                    className="field-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <rect
                      x="5"
                      y="10"
                      width="14"
                      height="10"
                      rx="2"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    />

                    <path
                      d="M8 10V7a4 4 0 0 1 8 0v3"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    />
                  </svg>

                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError('');
                    }}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                  />

                  <button
                    type="button"
                    className="password-eye"
                    onClick={() =>
                      setShowPassword((prev) => !prev)
                    }
                    aria-label={
                      showPassword
                        ? 'Hide password'
                        : 'Show password'
                    }
                  >
                    {showPassword ? '◉' : '◌'}
                  </button>

                </div>

              </div>


              {/* Error */}
              {error && (
                <div className="login-error">

                  <div className="login-error-icon">
                    !
                  </div>

                  <span>
                    {error}
                  </span>

                </div>
              )}


              {/* Sign in */}
              <button
                type="submit"
                disabled={loading || !email || !password}
                className="login-button"
              >

                {loading ? (
                  <>
                    <span className="login-spinner" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <span className="login-button-arrow">
                      →
                    </span>
                    Sign in
                  </>
                )}

              </button>

            </form>


            {/* Divider */}
            <div className="login-divider">
              <span />
              <strong>OR</strong>
              <span />
            </div>


            {/* Security */}
            <div className="secure-card">

              <div className="secure-icon">
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 3 20 6v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-3Z"
                    stroke="currentColor"
                    strokeWidth="1.7"
                  />
                  <path
                    d="m8.5 12 2.2 2.2 4.8-5"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              <div>
                <strong>
                  Secure Login
                </strong>

                <p>
                  Your data is protected with enterprise-grade security.
                </p>
              </div>

            </div>


            {/* Footer */}
            <div className="login-bottom-text">
              SupportHub • Ticket Management System
            </div>

          </div>

        </section>

      </div>

    </div>
  );
}