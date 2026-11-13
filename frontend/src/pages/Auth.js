import React, { useState, useEffect } from 'react';
import { ArrowRight } from '@phosphor-icons/react';
import { authenticate, subscribeAuth, logout as signOut } from '../services/localApi';
import '../styles/auth-beautiful.css';

export default function AuthPage({ onAuthSuccess, initialMode = 'login' }) {
  const [isLogin, setIsLogin] = useState(initialMode === 'login');
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({ username: '', email: '', password: '' });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => subscribeAuth(setUser), []);

  const handleChange = (event) => setFormData({ ...formData, [event.target.name]: event.target.value });
  const handleAuthenticate = async () => {
    if (pending) return;
    setPending(true);
    setError('');
    try {
      await authenticate(isLogin ? 'login' : 'signup', formData);
      onAuthSuccess?.();
    } catch (failure) {
      setError(failure.message || 'Unable to sign in. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  };

  const logout = async () => {
    try { await signOut(); }
    catch { setError('Unable to log out. Please try again.'); }
  };

  return (
    <div className="auth-card">
      <div className="auth-heading">
        <h2 id="auth-title">{user ? 'Welcome back.' : isLogin ? 'Your career questions, saved.' : 'Start exploring careers.'}</h2>
        <p>{user ? 'Your workspace is ready when you are.' : 'A local account for your conversations and learning plans.'}</p>
      </div>
      {user ? (
        <div className="auth-profile">
          <p>{user.displayName || user.email}</p>
          <button className="button button-primary" onClick={onAuthSuccess}>Continue to Chat <ArrowRight size={18} /></button>
          <button className="button button-quiet" onClick={logout}>Log out</button>
        </div>
      ) : (
        <>
          <div className="auth-tabs" aria-label="Account access">
            {['Login', 'Sign Up'].map((label, index) => <button key={label} type="button" className={isLogin === !index ? 'active' : ''} aria-pressed={isLogin === !index} disabled={pending} onClick={() => { setIsLogin(!index); setError(''); }}>{label}</button>)}
          </div>
          <form className="auth-form screen-enter" key={isLogin ? 'login' : 'signup'} onSubmit={event => { event.preventDefault(); handleAuthenticate(); }} aria-busy={pending}>
            {!isLogin && <div className="auth-field"><label htmlFor="auth-username">Name</label><input id="auth-username" name="username" autoComplete="nickname" maxLength={80} required value={formData.username} onChange={handleChange} disabled={pending} /></div>}
            <div className="auth-field"><label htmlFor="auth-email">Email</label><input id="auth-email" type="email" name="email" autoComplete="email" required value={formData.email} onChange={handleChange} placeholder="you@example.com" disabled={pending} /></div>
            <div className="auth-field"><label htmlFor="auth-password">Password</label><input id="auth-password" type="password" name="password" autoComplete={isLogin ? 'current-password' : 'new-password'} minLength={isLogin ? undefined : 12} maxLength={128} required value={formData.password} onChange={handleChange} aria-describedby={!isLogin ? 'password-help' : undefined} disabled={pending} />{!isLogin && <small id="password-help">At least 12 characters. A few memorable words work well.</small>}</div>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="button button-primary" type="submit" disabled={pending}>{pending ? 'Connecting...' : isLogin ? 'Login' : 'Sign Up'} <ArrowRight size={18} /></button>
          </form>
        </>
      )}
      {user && error && <p className="auth-error" role="alert">{error}</p>}
      <p className="auth-note">A thoughtful space for your education and career.</p>
    </div>
  );
}
