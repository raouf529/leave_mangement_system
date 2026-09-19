import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from './api';
import useCurrentUser from '../hooks/useCurrentUser';

/* ─── API helpers (admin endpoints) ─── */
const ADMIN_BASE = '/admin';

async function callAdmin(path, body) {
  const res = await api.post(`${ADMIN_BASE}${path}`, body);
  return res.data;
}

/* ─── Constants ─── */
const ROLE_LABELS = {
  admin: 'Administrateur',
  head: 'Chef',
  hr: 'RH',
  employee: 'Employé',
  directeur: 'Directeur',
  chef_departement: 'Chef de département',
  chef_service: 'Chef de service',
  drh: 'DRH',
  employe: 'Employé',
};

const AVATAR_PALETTE = ['#1F5673', '#C98A2C', '#3E8A5F', '#6C5CE7', '#C1544A', '#2D9CDB'];

/* ─── Utilities ─── */
function initialsOf(firstName, lastName) {
  const a = (firstName || '').trim().charAt(0);
  const b = (lastName || '').trim().charAt(0);
  return `${a}${b}`.toUpperCase() || '?';
}

function colorForId(id) {
  const n = Number(id) || 0;
  return AVATAR_PALETTE[n % AVATAR_PALETTE.length];
}

/* ─── Shared mini-components ─── */
function Avatar({ id, firstName, lastName, size = 36 }) {
  return (
    <span
      className="avatar-chip"
      style={{
        width: size,
        height: size,
        background: colorForId(id),
        fontSize: size * 0.38,
      }}
    >
      {initialsOf(firstName, lastName)}
    </span>
  );
}

function Feedback({ status }) {
  if (!status) return null;
  return (
    <div
      className={`feedback-msg ${status.type === 'success' ? 'feedback-success' : 'feedback-error'}`}
    >
      {status.type === 'success' ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
      )}
      {status.message}
    </div>
  );
}

/* ─── Admin Header ─── */
function AdminHeader() {
  const { fullName, roleLabel, role } = useCurrentUser();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await api.post('/auth/logout');
    } finally {
      sessionStorage.removeItem('role');
      setLoggingOut(false);
      navigate('/', { replace: true });
    }
  }

  return (
    <header className="admin-header">
      <div className="container d-flex align-items-center justify-content-between py-3">
        <div className="d-flex align-items-center gap-3">
          <div className="admin-header-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 15v2" />
              <path d="M5.5 13.18a8.5 8.5 0 0 1 13 0" />
              <path d="M3 11a10 10 0 0 1 18 0" />
              <circle cx="12" cy="19" r="2" />
            </svg>
          </div>
          <h1 className="h5 fw-bold mb-0" style={{ color: 'var(--ink)' }}>Administration</h1>
        </div>
        <div className="d-flex align-items-center gap-3">
          <div className="text-end d-none d-sm-block">
            <p className="mb-0 fw-semibold" style={{ color: 'var(--ink)' }}>{fullName}</p>
            <p className="mb-0" style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>
              {roleLabel || ROLE_LABELS[role] || role}
            </p>
          </div>
          <button
            type="button"
            className="logout-btn"
            onClick={handleLogout}
            disabled={loggingOut}
            aria-label="Déconnexion"
            title="Déconnexion"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10 17l5-5-5-5" />
              <path d="M15 12H3" />
              <path d="M21 19V5a2 2 0 0 0-2-2h-6" />
            </svg>
            <span className="logout-label">{loggingOut ? 'Déconnexion...' : 'Déconnexion'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}

/* ─── Global Actions Section ─── */
function GlobalActions() {
  const [open, setOpen] = useState(false);
  const [jobStatus, setJobStatus] = useState(null);
  const [jobLoading, setJobLoading] = useState(false);

  async function handleTriggerJob() {
    setJobStatus(null);
    setJobLoading(true);
    try {
      await callAdmin('/create-exercise', {});
      setJobStatus({ type: 'success', message: 'Exercice courant recalculé avec succès.' });
    } catch (err) {
      setJobStatus({ type: 'error', message: err.response?.data?.error || err.message });
    } finally {
      setJobLoading(false);
    }
  }

  return (
    <div className="section-card mb-4">
      <button
        type="button"
        className="global-actions-toggle"
        onClick={() => setOpen(!open)}
      >
        <div className="d-flex align-items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          <span className="fw-semibold">Actions globales</span>
        </div>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 200ms ease' }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="global-actions-body">
          <div className="row g-3">
            {/* Trigger monthly job */}
            <div className="col-md-6">
              <div className="action-card">
                <h3 className="action-card-title">Recalculer l'exercice courant</h3>
                <p className="muted-note mb-3">
                  Recalcule le solde depuis juillet. En septembre, le solde des anciens employés sera donc de 7,5 jours.
                </p>
                <button
                  type="button"
                  className="btn warning-button"
                  onClick={handleTriggerJob}
                  disabled={jobLoading}
                >
                  {jobLoading ? 'Recalcul…' : 'Recalculer maintenant'}
                </button>
                <Feedback status={jobStatus} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Main Admin Dashboard ─── */
export default function AdminDashboard() {
  const [employees, setEmployees] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState('');

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchEmployees() {
      try {
        const response = await api.get('/profile/all');
        setEmployees(response.data ?? []);
      } catch {
        setListError("Impossible de charger la liste des employés.");
      } finally {
        setLoadingList(false);
      }
    }
    fetchEmployees();
  }, []);


  const filteredEmployees = useMemo(() => {
    const term = search.trim().toLowerCase();
    return employees.filter((emp) => {
      const matchesRole = roleFilter === 'all' || emp.role === roleFilter;
      if (!matchesRole) return false;
      if (!term) return true;
      const fullName = `${emp.firstName ?? ''} ${emp.lastName ?? ''}`.toLowerCase();
      return fullName.includes(term) || (emp.email ?? '').toLowerCase().includes(term);
    });
  }, [employees, search, roleFilter]);

  const uniqueRoles = useMemo(() => {
    const roles = new Set(employees.map((e) => e.role).filter(Boolean));
    return [...roles].sort();
  }, [employees]);

  return (
    <div className="admin-dashboard">
      <style>{`
        /* ─── Design tokens (matching existing app) ─── */
        .admin-dashboard {
          --ink: #1B2430;
          --muted: #65707D;
          --surface: #FFFFFF;
          --canvas: #F5F7FA;
          --border: #E4E8ED;
          --primary: #1F5673;
          --primary-soft: #E8F0F4;
          --accent-amber: #C98A2C;
          --amber-soft: #FBF1DF;
          --success: #3E8A5F;
          --success-soft: #E7F4EC;
          --danger: #C1544A;
          --danger-soft: #FBEAE8;
          --neutral-soft: #EEF1F4;
          min-height: 100vh;
          background: var(--canvas);
          color: var(--ink);
        }

        /* ─── Admin header ─── */
        .admin-header {
          background: var(--surface);
          border-bottom: 1px solid var(--border);
        }
        .admin-header-icon {
          width: 40px;
          height: 40px;
          background: var(--primary-soft);
          color: var(--primary);
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
        }
        .logout-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          min-height: 40px;
          padding: 0.5rem 0.8rem;
          border: 1px solid #E4B7B7;
          border-radius: 10px;
          background: #FFF7F7;
          color: #A33A3A;
          font-size: 0.88rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 150ms ease, border-color 150ms ease, color 150ms ease;
        }
        .logout-btn:hover:not(:disabled) {
          background: #FCEAEA;
          border-color: #D99696;
          color: #872D2D;
        }
        .logout-btn:disabled { cursor: wait; opacity: 0.65; }
        @media (max-width: 575.98px) {
          .logout-label { display: none; }
          .logout-btn { width: 40px; justify-content: center; padding: 0; }
        }

        /* ─── Shared ─── */
        .section-card {
          background: var(--surface);
          border-radius: 14px;
          border: 1px solid var(--border);
        }
        .section-title {
          font-size: 1.05rem;
          font-weight: 600;
          color: var(--ink);
        }
        .muted-note {
          font-size: 0.82rem;
          color: var(--muted);
        }
        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 0.3rem 0.65rem;
          border-radius: 999px;
          font-size: 0.8rem;
          font-weight: 600;
        }
        .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          display: inline-block;
        }
        .avatar-chip {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          color: #fff;
          font-weight: 700;
          flex-shrink: 0;
        }
        .role-chip {
          background: var(--primary-soft);
          color: var(--primary);
          padding: 0.2rem 0.6rem;
          border-radius: 999px;
          font-size: 0.8rem;
          font-weight: 600;
        }
        .exercise-card {
          border-left: 3px solid #D8DEE5;
          background: #FAFBFC;
          border-radius: 10px;
          padding: 1rem 1.1rem;
        }
        .exercise-balance {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--primary);
        }
        .filter-input, .filter-select {
          border: 1px solid var(--border);
          border-radius: 10px;
        }
        .filter-input:focus, .filter-select:focus {
          border-color: var(--primary);
          box-shadow: 0 0 0 0.2rem rgba(31, 86, 115, 0.15);
        }
        .view-btn {
          border: 1px solid var(--primary);
          color: var(--primary);
          background: #fff;
          border-radius: 10px;
          font-size: 0.85rem;
          font-weight: 500;
          transition: background 150ms ease;
        }
        .view-btn:hover { background: var(--primary-soft); color: var(--primary); }
        .view-btn.active {
          background: var(--primary);
          color: #fff;
        }
        .close-btn {
          border: none;
          background: #F2F5F8;
          color: var(--muted);
          border-radius: 10px;
          font-weight: 500;
          font-size: 0.85rem;
          padding: 0.4rem 0.8rem;
          transition: background 150ms ease;
        }
        .close-btn:hover { background: #E4E8ED; }
        .emp-row-name {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .detail-panel-header {
          background: var(--primary-soft);
          border-radius: 14px 14px 0 0;
          margin: -1px -1px 0 -1px;
          padding: 1.5rem 1.5rem 1.25rem;
        }
        table.employee-table tbody tr {
          transition: background 100ms ease;
        }
        table.employee-table tbody tr:hover { background: #FAFBFC; }

        /* ─── Primary / Warning buttons ─── */
        .primary-button {
          background: var(--primary);
          color: #fff;
          border: none;
          border-radius: 10px;
          font-weight: 600;
          font-size: 0.88rem;
          padding: 0.45rem 1rem;
          transition: opacity 150ms ease;
        }
        .primary-button:hover:not(:disabled) { opacity: 0.9; color: #fff; }
        .primary-button:disabled { opacity: 0.6; color: #fff; }
        .warning-button {
          background: var(--accent-amber);
          color: #fff;
          border: none;
          border-radius: 10px;
          font-weight: 600;
          font-size: 0.88rem;
          padding: 0.45rem 1rem;
          transition: opacity 150ms ease;
        }
        .warning-button:hover:not(:disabled) { opacity: 0.9; color: #fff; }
        .warning-button:disabled { opacity: 0.6; color: #fff; }

        /* ─── Global actions section ─── */
        .global-actions-toggle {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 1.25rem;
          border: none;
          background: none;
          color: var(--ink);
          font-size: 0.95rem;
          cursor: pointer;
          transition: background 100ms ease;
        }
        .global-actions-toggle:hover { background: #FAFBFC; }
        .global-actions-body {
          padding: 0 1.25rem 1.25rem;
          border-top: 1px solid var(--border);
          padding-top: 1.25rem;
        }
        .action-card {
          background: #FAFBFC;
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 1.1rem 1.25rem;
          height: 100%;
        }
        .action-card-title {
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--ink);
          margin-bottom: 0.5rem;
        }

        /* ─── Admin action pills ─── */
        .admin-action-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 0.4rem 0.85rem;
          border: 1px solid var(--border);
          border-radius: 999px;
          background: #fff;
          color: var(--ink);
          font-size: 0.82rem;
          font-weight: 600;
          transition: all 150ms ease;
        }
        .admin-action-pill:hover {
          border-color: var(--primary);
          color: var(--primary);
          background: var(--primary-soft);
        }
        .admin-action-pill.active {
          background: var(--primary);
          color: #fff;
          border-color: var(--primary);
        }
        .admin-action-icon { font-size: 0.95rem; }
        .admin-action-form {
          background: #FAFBFC;
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 1rem 1.25rem;
          animation: slideDown 200ms ease;
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* ─── Admin actions section ─── */
        .admin-actions-section {
          border-top: 1px solid var(--border);
          padding-top: 1.5rem;
          margin-top: 0.5rem;
        }

        /* ─── Feedback messages ─── */
        .feedback-msg {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0.55rem 0.85rem;
          border-radius: 10px;
          font-size: 0.85rem;
          font-weight: 500;
          margin-top: 0.75rem;
          animation: slideDown 200ms ease;
        }
        .feedback-success {
          background: var(--success-soft);
          color: var(--success);
        }
        .feedback-error {
          background: var(--danger-soft);
          color: var(--danger);
        }

        /* ─── Stats strip ─── */
        .stat-strip {
          display: flex;
          gap: 1.5rem;
          flex-wrap: wrap;
        }
        .stat-block { min-width: 70px; }
        .stat-number {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--primary);
          line-height: 1;
        }
        .stat-label {
          color: var(--muted);
          font-size: 0.76rem;
          margin-top: 2px;
        }
      `}</style>

      <AdminHeader />

      <main className="container py-4 py-md-5">
        {/* Stats */}
        <div className="section-card p-4 mb-4">
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
            <div>
              <h2 className="h4 fw-bold mb-1">Gestion des employés</h2>
              <p className="muted-note mb-0">
                Gérez les exercices, soldes et demandes de congé de chaque employé
              </p>
            </div>
            <div className="stat-strip">
              <div className="stat-block text-center">
                <p className="stat-number mb-0">{employees.length}</p>
                <p className="stat-label mb-0">Employés</p>
              </div>
            </div>
          </div>
        </div>

        {/* Global actions */}
        <GlobalActions />

        {/* Employee list */}
        <div className="section-card p-4 p-md-5 mb-4">
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-4">
            <h2 className="section-title mb-0">Employés</h2>
            <div className="d-flex flex-wrap gap-2">
              <input
                type="text"
                className="form-control filter-input"
                placeholder="Rechercher par nom ou email"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ minWidth: '220px' }}
              />
              <select
                className="form-select filter-select"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                style={{ minWidth: '160px' }}
              >
                <option value="all">Tous les rôles</option>
                {uniqueRoles.map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>
                ))}
              </select>
            </div>
          </div>

          {listError && (
            <div className="alert alert-danger py-2 small" role="alert">{listError}</div>
          )}

          {loadingList ? (
            <div className="text-center muted-note py-5">Chargement...</div>
          ) : filteredEmployees.length === 0 ? (
            <p className="muted-note mb-0">Aucun employé ne correspond à cette recherche.</p>
          ) : (
            <div className="table-responsive">
              <table className="table align-middle employee-table">
                <thead>
                  <tr className="muted-note text-uppercase">
                    <th>Nom</th>
                    <th>Email</th>
                    <th>Rôle</th>
                    <th>Unité</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((emp) => (
                    <tr key={emp.id}>
                      <td>
                        <div className="emp-row-name">
                          <Avatar id={emp.id} firstName={emp.firstName} lastName={emp.lastName} />
                          <span className="fw-medium">{emp.firstName} {emp.lastName}</span>
                        </div>
                      </td>
                      <td className="muted-note">{emp.email}</td>
                      <td>
                        <span className="role-chip">
                          {emp.roleLabel ?? ROLE_LABELS[emp.role] ?? emp.role}
                        </span>
                      </td>
                      <td>{emp.unit?.name ?? '—'}</td>
                      <td className="text-end">
                        <button
                          className="btn btn-sm view-btn"
                          onClick={() => navigate(`/admin/employees/${emp.id}`)}
                        >
                          Gérer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}