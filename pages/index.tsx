// ═══════════════════════════════════════════════════════════════════════════════
// FILE: pages/index.tsx - Login Page (v6 — framed + Ken Burns)
// Replace your existing pages/index.tsx with this entire file
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { useRouter } from 'next/router';
   import { supabase } from '../lib/supabaseClient';

const MailIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m2 6 10 7 10-7" /></svg>
);
const LockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
);
const EyeIcon = ({ open }: { open: boolean }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
    {open ? (
      <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>
    ) : (
      <><path d="M3 3l18 18" /><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.5 5.2A9.8 9.8 0 0 1 12 5c6.5 0 10 7 10 7a13.2 13.2 0 0 1-2.6 3.4M6.6 6.6C4 8.3 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 4-.8" /></>
    )}
  </svg>
);

export default function Home() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (isSignUp) {
        const { error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
        alert('Check your email for the confirmation link!');
        setEmail('');
        setPassword('');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        router.push('/app');
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Enter your email above first, then click "Forgot password?"');
      return;
    }
    setError('');
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);
    if (resetError) setError(resetError.message);
    else alert(`Password reset link sent to ${email}`);
  };

  const handleGoogleSignIn = async () => {
    const { error: oauthError } = await supabase.auth.signInWithOAuth({ provider: 'google' });
    if (oauthError) setError('Google sign-in isn\'t set up yet: ' + oauthError.message);
  };

  return (
    <div className="login-outer">
      <div className="login-split">
        {/* ─── LEFT: photo + marketing ─── */}
        <div className="login-photo-panel">
          <div className="kb-bg" aria-hidden="true" />

          <nav className="login-nav">
            <div className="nav-brand">
              <span className="mark">🌾</span>
              <span className="name">FarmAssist</span>
            </div>
            <div className="login-nav-links">
              <a>How it works</a>
              <a>Features</a>
              <a>For farmers ▾</a>
            </div>
            <div className="login-lang-pill">🌐 Twi ▾</div>
          </nav>

          <div className="login-hero-copy">
            <h2>AI-powered guidance.</h2>
            <h2><span className="accent">Stronger farms. Better futures.</span></h2>
            <p className="desc">
              Ask in Twi or your language. Get trusted advice for crops, animals and your farm business.
            </p>

            <div className="login-stats">
              <div className="login-stat">
                <span className="stat-icon">👥</span>
                <div><span className="stat-num">Built for</span><span className="stat-label">Ghanaian farmers</span></div>
              </div>
              <div className="login-stat">
                <span className="stat-icon">🌱</span>
                <div><span className="stat-num">3 categories</span><span className="stat-label">Crops, animals & business</span></div>
              </div>
              <div className="login-stat">
                <span className="stat-icon">🔒</span>
                <div><span className="stat-num">Safe & trusted</span><span className="stat-label">Your data is protected</span></div>
              </div>
            </div>

            <div className="login-badge-strip">🇬🇭 Proudly made for African farmers</div>
          </div>
        </div>

        {/* ─── RIGHT: form ─── */}
        <div className="login-form-panel">
          <div className="login-card">
            <div className="login-card-brand">
              <span className="mark">🌾</span>
              <h1>FarmAssist</h1>
            </div>

            <h2 className="login-headline">Smart farming advice, <span className="accent">in your language.</span></h2>
            <p className="login-subtext">Sign in to ask questions, get AI advice, and manage your farm with ease.</p>

            <form onSubmit={handleAuth}>
              <div className="icon-field">
                <label htmlFor="email">Email</label>
                <div className="icon-wrap">
                  <MailIcon />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                  />
                </div>
              </div>

              <div className="icon-field">
                <label htmlFor="password">Password</label>
                <div className="icon-wrap">
                  <LockIcon />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                  <button type="button" className="toggle-eye" onClick={() => setShowPassword(!showPassword)} aria-label="Toggle password visibility">
                    <EyeIcon open={showPassword} />
                  </button>
                </div>
              </div>

              <div className="login-row-between">
                <label className="remember-me">
                  <input type="checkbox" defaultChecked />
                  Remember me
                </label>
                <button type="button" className="forgot-link" onClick={handleForgotPassword}>
                  Forgot password?
                </button>
              </div>

              {error && <div className="error-box">{error}</div>}

              <button type="submit" className="btn-signin" disabled={loading}>
                {loading ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in'} {!loading && '→'}
              </button>
            </form>

            <div className="login-divider">or continue with</div>

            <button className="btn-google" onClick={handleGoogleSignIn} type="button">
              <span className="google-g">G</span> Continue with Google
            </button>

            <p className="login-switch">
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
              <button onClick={() => { setIsSignUp(!isSignUp); setError(''); }}>
                {isSignUp ? 'Sign in' : 'Create one'}
              </button>
            </p>
          </div>

          <div className="feature-badges">
            <div className="feature-badge">
              <span className="fb-icon">💬</span>
              <div className="fb-title">Twi & local languages</div>
              <div className="fb-desc">Ask in Twi or your language</div>
            </div>
            <div className="feature-badge">
              <span className="fb-icon">🌿</span>
              <div className="fb-title">AI crop & animal advice</div>
              <div className="fb-desc">Instant, reliable recommendations</div>
            </div>
            <div className="feature-badge">
              <span className="fb-icon">📶</span>
              <div className="fb-title">Works with low connectivity</div>
              <div className="fb-desc">Designed for rural Africa</div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Footer ─── */}
      <div className="login-footer">
        <div className="footer-brand">🌾 FarmAssist</div>
        <span>© 2026 FarmAssist. All rights reserved.</span>
        <div className="footer-mid">
          <span>🔒 Your data is secure</span>
          <span>🛡️ Enterprise-grade security</span>
        </div>
        <div className="footer-links">
          <span>Privacy Policy</span>
          <span>Terms of Service</span>
          <span>Help & Support</span>
        </div>
        <div className="footer-social">
          <span>f</span><span>w</span><span>▶</span>
        </div>
      </div>
    </div>
  );
}