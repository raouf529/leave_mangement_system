import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

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
      await axios.post(
        'http://localhost:5000/api/auth/login',
        { email, password },
        { withCredentials: true }
      );
      navigate('/dashboard');
    } catch (error) {
      setError('Email ou mot de passe incorrect');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="d-flex align-items-center justify-content-center min-vh-100"
      style={{ background: 'linear-gradient(135deg, #eef2fb 0%, #f7f9fc 100%)' }}
    >
      <div
        className="bg-white shadow rounded-4 overflow-hidden"
        style={{ width: '100%', maxWidth: '420px' }}
      >
        <div style={{ height: '6px', backgroundColor: '#0d6efd' }} />

        <div className="p-4 p-md-5">
          <div className="text-center mb-4">
            <h1 className="h3 fw-bold mb-1">Gestion des congés</h1>
            <p className="text-muted mb-0">Connectez-vous pour accéder à votre espace</p>
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

            <button
              type="submit"
              className="btn btn-primary btn-lg w-100"
              disabled={loading}
            >
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Login;