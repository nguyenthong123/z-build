import React, { useState } from 'react';
import { createUserWithEmailAndPassword, signInWithPopup, updateProfile } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import './SignUp.css';
import { useToast } from '../context/ToastContext';

const SignUp = ({ onSignUp, onBack, onLogin }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { addToast } = useToast();

  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (name && email && password) {
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: name });
        
        onSignUp({ 
          uid: userCredential.user.uid,
          email: userCredential.user.email,
          name: name
        });
      } catch (error) {
        console.error("Sign up error:", error);
        setError(error.message || "Failed to create account.");
        addToast(error.message || "Lỗi khi đăng ký tài khoản.", "error");
      }
    }
  };

  const handleGoogleSignUp = async () => {
    setError('');
    try {
      const userCredential = await signInWithPopup(auth, googleProvider);
      onSignUp({
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        name: userCredential.user.displayName || 'Google User',
        photoURL: userCredential.user.photoURL || null
      });
    } catch (error) {
      console.error("Google signup error:", error);
      setError("Failed to sign up with Google.");
      addToast("Không thể đăng ký bằng Google.", "error");
    }
  };

  return (
    <div className="signup-page">
      {/* Mobile Header */}
      <header className="mobile-signup-header mobile-only">
        <button className="back-btn" onClick={onBack}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
        </button>
        <h1>Sign Up</h1>
        <div className="placeholder"></div>
      </header>

      <div className="signup-container">
        {/* Mobile Hero Image */}
        <div className="mobile-hero mobile-only">
          <img src="/login-hero.png" alt="Welcome" />
        </div>

        <div className="signup-card">
          <div className="signup-header">
            <h2>Create Account</h2>
            <p>Join Zbuild for an amazing shopping experience</p>
          </div>

          <button className="google-signup-btn" onClick={handleGoogleSignUp}>
            <svg width="20" height="20" viewBox="0 0 24 24">
               <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
               <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
               <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
               <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <div className="separator">
            <span>OR EMAIL</span>
          </div>

          {error && <div className="error-message" style={{color: 'red', textAlign: 'center', fontSize: '0.9rem'}}>{error}</div>}

          <form onSubmit={handleSubmit} className="signup-form">
            <div className="form-group">
              <label>Full Name</label>
              <div className="input-with-icon">
                <svg className="input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                <input 
                  type="text" 
                  placeholder="John Doe" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required 
                />
              </div>
            </div>

            <div className="form-group">
              <label>Email Address</label>
              <div className="input-with-icon">
                <svg className="input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m22 2-10 6L2 2"/><rect width="20" height="16" x="2" y="6" rx="2"/></svg>
                <input 
                  type="email" 
                  placeholder="name@example.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required 
                />
              </div>
            </div>

            <div className="form-group">
              <div className="label-row">
                <label>Password</label>
              </div>
              <div className="input-with-icon">
                <svg className="input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                <input 
                  type={showPassword ? "text" : "password"} 
                  placeholder="••••••••" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required 
                  minLength="6"
                />
                <button 
                  type="button" 
                  className="visibility-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
            </div>

            <button type="submit" className="signup-submit-btn">
              {window.innerWidth <= 768 ? "Sign Up with Email" : "Create Account"}
            </button>
          </form>

          <div className="signup-footer">
            <span>Already have an account?</span>
            <button className="login-link" onClick={onLogin}>Log in</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignUp;
