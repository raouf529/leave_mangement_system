import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from './api';
import useCurrentUser from '../hooks/useCurrentUser';
import './AdminDashboard.css';

/* ─── API helpers ─── */
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

/* ════════════════════════════════════════════════
   TOAST SYSTEM
   ════════════════════════════════════════════════ */
let _addToast = null;

export function toast(message, type = 'error', duration = 4000) {
  if (_addToast) _addToast({ message, type, duration });
}

function ToastContainer() {
  const [toasts, setToasts] = useState([]);
  const counter = useRef(0);

  useEffect(() => {
    _addToast = ({ message, type, duration }) => {
      const id = ++counter.current;
      setToasts((prev) => [...prev, { id, message, type, duration, exiting: false }]);
      setTimeout(() => {
        setToasts((prev) =>
          prev.map((t) => (t.id === id ? { ...t, exiting: true } : t))
        );
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 400);
      }, duration);
    };
    return () => { _addToast = null; };
  }, []);

  const dismiss = (id) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 400);
  };

  return (
    <div className="toast-container" aria-live="assertive" aria-atomic="true">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast-item toast-${t.type} ${t.exiting ? 'toast-exit' : 'toast-enter'}`}
          role="alert"
        >
          <span className="toast-icon">
            {t.type === 'success' && (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
            )}
            {t.type === 'error' && (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            )}
            {t.type === 'info' && (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            )}
          </span>
          <span className="toast-message">{t.message}</span>
          <button className="toast-close" onClick={() => dismiss(t.id)} aria-label="Fermer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════════
   CONFIRM MODAL  (replaces window.confirm)
   ════════════════════════════════════════════════ */
function ConfirmModal({ open, title, message, confirmLabel = 'Confirmer', danger = false, onConfirm, onCancel }) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-dialog-custom" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-dialog-header">
          <span className={`modal-dialog-icon ${danger ? 'icon-danger' : 'icon-info'}`}>
            {danger ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            )}
          </span>
          <h3 className="modal-dialog-title">{title}</h3>
        </div>
        <p className="modal-dialog-body">{message}</p>
        <div className="modal-dialog-actions">
          <button className="modal-btn modal-btn-cancel" onClick={onCancel}>Annuler</button>
          <button className={`modal-btn ${danger ? 'modal-btn-danger' : 'modal-btn-primary'}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════
   INPUT MODAL  (replaces prompt)
   ════════════════════════════════════════════════ */
function InputModal({ open, title, fields, onConfirm, onCancel }) {
  const [values, setValues] = useState({});

  useEffect(() => {
    if (open) {
      const init = {};
      (fields || []).forEach((f) => { init[f.name] = f.defaultValue ?? ''; });
      setValues(init);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open, fields]);

  if (!open) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirm(values);
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-dialog-custom" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-dialog-header">
          <span className="modal-dialog-icon icon-info">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
          </span>
          <h3 className="modal-dialog-title">{title}</h3>
        </div>
        <form onSubmit={handleSubmit} className="modal-dialog-form">
          {(fields || []).map((f) => (
            <div key={f.name} className="modal-form-group">
              <label className="modal-form-label">{f.label}</label>
              <input
                type={f.type || 'text'}
                className="modal-form-input"
                value={values[f.name] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                placeholder={f.placeholder ?? ''}
                required={f.required !== false}
              />
            </div>
          ))}
          <div className="modal-dialog-actions">
            <button type="button" className="modal-btn modal-btn-cancel" onClick={onCancel}>Annuler</button>
            <button type="submit" className="modal-btn modal-btn-primary">Confirmer</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Shared mini-components ─── */
function Avatar({ id, firstName, lastName, size = 36 }) {
  return (
    <span
      className="avatar-chip"
      style={{ width: size, height: size, background: colorForId(id), fontSize: size * 0.38 }}
    >
      {initialsOf(firstName, lastName)}
    </span>
  );
}

function Feedback({ status }) {
  if (!status) return null;
  return (
    <div className={`feedback-msg ${status.type === 'success' ? 'feedback-success' : 'feedback-error'}`}>
      {status.type === 'success' ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
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
    try { await api.post('/auth/logout'); }
    finally {
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
              <path d="M12 15v2"/><path d="M5.5 13.18a8.5 8.5 0 0 1 13 0"/><path d="M3 11a10 10 0 0 1 18 0"/><circle cx="12" cy="19" r="2"/>
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
          <button type="button" className="logout-btn" onClick={handleLogout} disabled={loggingOut} aria-label="Déconnexion">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M21 19V5a2 2 0 0 0-2-2h-6"/>
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
      setJobStatus({ type: 'success', message: 'Exercices globaux créés/recalculés avec succès.' });
    } catch (err) {
      setJobStatus({ type: 'error', message: err.response?.data?.error || err.message });
    } finally {
      setJobLoading(false);
    }
  }

  return (
    <div className="section-card mb-4">
      <button type="button" className="global-actions-toggle" onClick={() => setOpen(!open)}>
        <div className="d-flex align-items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          <span className="fw-semibold">Actions globales</span>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 200ms ease' }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && (
        <div className="global-actions-body">
          <div className="row g-3">
            <div className="col-md-6">
              <div className="action-card">
                <h3 className="action-card-title">Recréer l'exercice pour tous</h3>
                <p className="muted-note mb-3">Lance le calcul et la création de l'exercice pour tous les employés.</p>
                <button type="button" className="btn warning-button" onClick={handleTriggerJob} disabled={jobLoading}>
                  {jobLoading ? 'Traitement…' : 'Créer exercice (tous)'}
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
  const [logs, setLogs] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState('');
  const [activeTab, setActiveTab] = useState('employees');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const navigate = useNavigate();

  /* ── Modal state ── */
  const [confirmModal, setConfirmModal] = useState({ open: false });
  const [inputModal, setInputModal] = useState({ open: false });

  /* ── Imperative modal helpers ── */
  const openConfirm = useCallback((opts) => {
    return new Promise((resolve) => {
      setConfirmModal({
        open: true, ...opts,
        onConfirm: () => { setConfirmModal({ open: false }); resolve(true); },
        onCancel:  () => { setConfirmModal({ open: false }); resolve(false); },
      });
    });
  }, []);

  const openInput = useCallback((opts) => {
    return new Promise((resolve) => {
      setInputModal({
        open: true, ...opts,
        onConfirm: (vals) => { setInputModal({ open: false }); resolve(vals); },
        onCancel:  () => { setInputModal({ open: false }); resolve(null); },
      });
    });
  }, []);

  /* ── Data fetching ── */
  const fetchEmployees = useCallback(async () => {
    setLoadingList(true);
    setListError('');
    try {
      const response = await api.get('/profile/all');
      setEmployees(response.data ?? []);
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Erreur inconnue';
      setListError(`Impossible de charger la liste des employés : ${msg}`);
    } finally {
      setLoadingList(false);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await api.get('/admin/logs');
      setLogs(res.data ?? []);
    } catch {
      toast('Impossible de charger les journaux.', 'error');
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'employees') fetchEmployees();
    else if (activeTab === 'logs') fetchLogs();
  }, [activeTab, fetchEmployees, fetchLogs]);

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

  /* ── Action handlers ── */
  const handleAssignDRH = async (emp) => {
    const confirmed = await openConfirm({
      title: 'Assigner comme DRH',
      message: `Êtes-vous sûr de vouloir assigner ${emp.firstName} ${emp.lastName} comme DRH ? L'ancien DRH perdra ce rôle.`,
      confirmLabel: 'Assigner',
      danger: false,
    });
    if (!confirmed) return;
    try {
      await api.post('/admin/assign-drh', { empId: emp.id });
      toast(`${emp.firstName} ${emp.lastName} assigné(e) comme DRH avec succès.`, 'success');
      fetchEmployees();
    } catch (e) {
      toast(e.response?.data?.error || e.message, 'error');
    }
  };

  const handleToggleCreateForOthers = async (emp) => {
    const newPerm = emp.canCreateForEmployee ? 0 : 1;
    try {
      await api.post('/admin/assign-create-others', { empId: emp.id, permission: newPerm });
      toast(
        `Permission "Création pour autrui" ${newPerm ? 'activée' : 'désactivée'} pour ${emp.firstName} ${emp.lastName}.`,
        'success'
      );
      fetchEmployees();
    } catch (e) {
      toast(e.response?.data?.error || e.message, 'error');
    }
  };

  const handleCreateExerciseIndividual = async (emp) => {
    const values = await openInput({
      title: `Créer un exercice — ${emp.firstName} ${emp.lastName}`,
      fields: [
        { name: 'year',    label: "Année",         type: 'number', defaultValue: String(new Date().getFullYear()), placeholder: 'ex: 2026', required: true },
        { name: 'balance', label: 'Solde initial', type: 'number', defaultValue: '0',                              placeholder: 'ex: 0',    required: true },
      ],
    });
    if (!values) return;
    try {
      await api.post('/admin/create-exercise-by-id', {
        empId: emp.id,
        year: Number(values.year),
        balance: Number(values.balance),
      });
      toast(`Exercice ${values.year} créé avec succès pour ${emp.firstName} ${emp.lastName}.`, 'success');
    } catch (e) {
      toast(e.response?.data?.error || e.message, 'error');
    }
  };

  return (
    <div className="admin-dashboard">
      <ToastContainer />

      <ConfirmModal
        open={confirmModal.open}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmLabel={confirmModal.confirmLabel}
        danger={confirmModal.danger}
        onConfirm={confirmModal.onConfirm}
        onCancel={confirmModal.onCancel}
      />

      <InputModal
        open={inputModal.open}
        title={inputModal.title}
        fields={inputModal.fields}
        onConfirm={inputModal.onConfirm}
        onCancel={inputModal.onCancel}
      />

      <AdminHeader />

      <main className="container py-4 py-md-5">
        <div className="d-flex mb-4 gap-3">
          <button className={`btn ${activeTab === 'employees' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setActiveTab('employees')}>
            Employés
          </button>
          <button className={`btn ${activeTab === 'logs' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setActiveTab('logs')}>
            Historique / Logs
          </button>
        </div>

        {activeTab === 'employees' && (
          <>
            {/* Stats */}
            <div className="section-card p-4 mb-4">
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
                <div>
                  <h2 className="h4 fw-bold mb-1">Gestion des employés</h2>
                  <p className="muted-note mb-0">Gérez les exercices, rôles et permissions des employés</p>
                </div>
                <div className="stat-strip">
                  <div className="stat-block text-center">
                    <p className="stat-number mb-0">{employees.length}</p>
                    <p className="stat-label mb-0">Employés</p>
                  </div>
                </div>
              </div>
            </div>

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
                <div className="list-error-banner" role="alert">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <span>{listError}</span>
                  <button className="list-error-retry" onClick={fetchEmployees}>Réessayer</button>
                </div>
              )}

              {loadingList ? (
                <div className="text-center muted-note py-5">
                  <div className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></div>
                  Chargement…
                </div>
              ) : filteredEmployees.length === 0 && !listError ? (
                <p className="muted-note mb-0">Aucun employé ne correspond à cette recherche.</p>
              ) : (
                <div className="table-responsive">
                  <table className="table align-middle employee-table">
                    <thead>
                      <tr className="muted-note text-uppercase">
                        <th>Nom</th><th>Email</th><th>Rôle</th><th>Actions Administratives</th><th></th>
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
                            <span className="role-chip">{emp.roleLabel ?? ROLE_LABELS[emp.role] ?? emp.role}</span>
                          </td>
                          <td>
                            <div className="d-flex gap-2 flex-wrap">
                              <button
                                className="btn btn-sm btn-outline-secondary"
                                onClick={() => handleAssignDRH(emp)}
                                disabled={emp.role === 'drh' || emp.role === 'admin'}
                              >
                                {emp.role === 'drh' ? 'Actuel DRH' : 'Assigner DRH'}
                              </button>

                              <button
                                className={`btn btn-sm ${emp.canCreateForEmployee ? 'btn-success' : 'btn-outline-secondary'}`}
                                onClick={() => handleToggleCreateForOthers(emp)}
                                disabled={['employee', 'admin', 'hr'].includes(emp.role)}
                                title="Créer demandes pour les autres"
                              >
                                Création pour autrui : {emp.canCreateForEmployee ? 'Oui' : 'Non'}
                              </button>

                              <button
                                className="btn btn-sm btn-outline-info"
                                onClick={() => handleCreateExerciseIndividual(emp)}
                              >
                                Créer Ex.
                              </button>
                            </div>
                          </td>
                          <td className="text-end">
                            <button className="btn btn-sm view-btn" onClick={() => navigate(`/admin/employees/${emp.id}`)}>
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
          </>
        )}

        {activeTab === 'logs' && (
          <div className="section-card p-4 p-md-5 mb-4">
            <h2 className="section-title mb-4">Journaux système (Logs)</h2>
            {logs.length === 0 ? (
              <p className="muted-note">Aucun log disponible.</p>
            ) : (
              <div className="table-responsive">
                <table className="table align-middle table-sm">
                  <thead>
                    <tr className="muted-note text-uppercase">
                      <th>Date</th><th>Action</th><th>Détails</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log, idx) => (
                      <tr key={idx}>
                        <td className="text-nowrap">{new Date(log.created_at).toLocaleString()}</td>
                        <td><span className="badge bg-secondary">{log.action || log.action_type || 'INFO'}</span></td>
                        <td>{log.message || log.description || JSON.stringify(log)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}