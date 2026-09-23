import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from './api';
import useCurrentUser from '../hooks/useCurrentUser';
import './AdminDashboard.css';

/* ─── API helpers─── */
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