import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from './api';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // withCredentials lets the browser accept/send the httpOnly cookies
      // the server sets — no tokens ever touch JS or localStorage.
      const res = await api.post('/auth/login', { email, password });
      let role = res.data?.role;

      if (!role) {
        try {
          const meRes = await api.get('/auth/me');
          role = meRes.data?.role;
        } catch (err) {
          // ignore
        }
      }

      if (role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (error) {
      setError('Email ou mot de passe incorrect');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page d-flex align-items-center justify-content-center min-vh-100">
      <style>{`
        .login-page {
          --ink: #1B2430;
          --muted: #65707D;
          --canvas: #F5F7FA;
          --primary: #1F5673;
          background: var(--canvas);
        }
        .login-page .accent-bar { height: 6px; background: var(--primary); }
        .login-page .login-title { color: var(--ink); }
        .login-page .login-subtitle { color: var(--muted); }
        .login-page .btn-primary-solid { background: var(--primary); color: #fff; border: none; }
        .login-page .btn-primary-solid:disabled { opacity: 0.6; }
      `}</style>

      <div className="bg-white shadow rounded-4 overflow-hidden" style={{ width: '100%', maxWidth: '420px' }}>
        <div className="accent-bar" />

        <div className="p-4 p-md-5">
          <div className="text-center mb-4">
            <h1 className="h3 fw-bold mb-1 login-title">Gestion des congés</h1>
            <p className="login-subtitle mb-0">Connectez-vous pour accéder à votre espace</p>
          </div>

          <form onSubmit={handleLogin} noValidate>
            <div className="mb-3">
              <label htmlFor="email" className="form-label fw-medium">Email</label>
              <input
                type="email"
                id="email"
                className="form-control form-control-lg"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="mb-4">
              <label htmlFor="password" className="form-label fw-medium">Mot de passe</label>
              <input
                type="password"
                id="password"
                className="form-control form-control-lg"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <div className="alert alert-danger py-2 small" role="alert">
                {error}
              </div>
            )}

            <button type="submit" className="btn btn-primary-solid btn-lg w-100" disabled={loading}>
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Login;