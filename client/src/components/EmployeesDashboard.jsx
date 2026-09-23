import { useState, useEffect, useMemo, useRef } from 'react';
import api from './api';
import Header from './header';
import LeaveRequestModal from './LeaveRequestModal';
import useCurrentUser from '../hooks/useCurrentUser';
import './EmployeesDashboard.css';

function getUnitInformation() {
  return api.get('/profile/me/underemployees');
}

function getEmployeeInformation(id) {
  return api.get(`/profile/${id}`);
}

const LEAVE_TYPE_LABELS = {
  annual: 'Congé annuel',
  exceptional: 'Congé exceptionnel',
  advance: 'Avance sur congé'
};

const STATUS_LABELS = {
  pending: 'En attente',
  approved: 'Approuvée',
  rejected: 'Refusée',
  cancelled: 'Annulée'
};

const STATUS_STYLES = {
  pending: { bg: 'var(--amber-soft)', fg: 'var(--accent-amber)' },
  approved: { bg: 'var(--success-soft)', fg: 'var(--success)' },
  rejected: { bg: 'var(--danger-soft)', fg: 'var(--danger)' },
  cancelled: { bg: 'var(--neutral-soft)', fg: 'var(--muted)' }
};

const ROLE_LABELS = {
  head: 'Chef',
  hr: 'RH',
  employee: 'Employé'
};

const AVATAR_PALETTE = ['#1F5673', '#8A5300', '#13694D', '#5B5F97', '#B03A2E', '#4A6B82'];

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('fr-FR');
}

function getEndDate(startDate, duration) {
  if (!startDate) return null;
  const d = new Date(startDate);
  d.setDate(d.getDate() + (Number(duration) || 0));
  return d;
}

function initialsOf(firstName, lastName) {
  const a = (firstName || '').trim().charAt(0);
  const b = (lastName || '').trim().charAt(0);
  return `${a}${b}`.toUpperCase() || '?';
}

function colorForId(id) {
  const n = Number(id) || 0;
  return AVATAR_PALETTE[n % AVATAR_PALETTE.length];
}

function Avatar({ id, firstName, lastName, size = 36 }) {
  return (
    <span
      className="avatar-chip"
      style={{
        width: size,
        height: size,
        background: colorForId(id),
        fontSize: size * 0.38
      }}
    >
      {initialsOf(firstName, lastName)}
    </span>
  );
}

function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.cancelled;
  return (
    <span className="status-badge" style={{ background: style.bg, color: style.fg }}>
      <span className="status-dot" style={{ background: style.fg }} />
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function EmployeesDashboard() {
  const [employees, setEmployees] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState('');
  const { user: currentUser, role: currentRole, loading: currentUserLoading } = useCurrentUser();

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [requestTargetId, setRequestTargetId] = useState(null);
  const [requestTargetName, setRequestTargetName] = useState('');
  const detailRequestRef = useRef(0);

  // Filters for employee's request history
  const [detailFilterStatus, setDetailFilterStatus] = useState('all');
  const [detailFilterStartDate, setDetailFilterStartDate] = useState('');
  const [detailFilterActive, setDetailFilterActive] = useState(false);

  useEffect(() => {
    async function fetchList() {
      try {
        const response = await getUnitInformation();
        console.log('Fetched employees:', response.data);
        setEmployees(response.data ?? []);
      } catch (err) {
        console.error('Error fetching employees:', err);
        setListError("Impossible de charger la liste des employés.");
      } finally {
        setLoadingList(false);
      }
    }

    if (currentUserLoading) {
      return;
    }

    if (currentRole === 'head' || currentRole === 'hr') {
      fetchList();
    } else {
      setLoadingList(false);
      setListError('Accès réservé aux responsables.');
    }
  }, [currentRole, currentUserLoading]);

  const filteredEmployees = useMemo(() => {
    const term = search.trim().toLowerCase();
    return employees.filter((emp) => {
      const matchesRole = roleFilter === 'all' || emp.role === roleFilter;
      if (!matchesRole) return false;
      if (!term) return true;
      const fullName = `${emp.firstName} ${emp.lastName}`.toLowerCase();
      return fullName.includes(term) || (emp.email ?? '').toLowerCase().includes(term);
    });
  }, [employees, search, roleFilter]);

  const teamCounts = useMemo(() => {
    return employees.reduce(
      (acc, emp) => {
        acc.total += 1;
        acc[emp.role] = (acc[emp.role] ?? 0) + 1;
        return acc;
      },
      { total: 0 }
    );
  }, [employees]);

  async function handleViewDetails(id) {
    const requestId = ++detailRequestRef.current;
    setSelectedId(id);
    setDetail(null);
    setDetailError('');
    setDetailLoading(true);
    try {
      const response = await getEmployeeInformation(id);
      if (requestId !== detailRequestRef.current) {
        return;
      }
      setDetail(response.data);
    } catch (err) {
      console.error('Error fetching employee details:', err);
      if (requestId !== detailRequestRef.current) {
        return;
      }
      setDetailError("Impossible de charger les informations de cet employé.");
    } finally {
      if (requestId === detailRequestRef.current) {
        setDetailLoading(false);
      }
    }
  }

  function closeDetails() {
    setSelectedId(null);
    setDetail(null);
    setDetailError('');
  }

  const activeExercises = (detail?.exercises ?? []).filter((ex) => Number(ex.balance) > 0);
  const leaveRequests = detail?.leaveRequests ?? [];

  const filteredLeaveRequests = useMemo(() => {
    return leaveRequests.filter((lr) => {
      // Status filter
      if (detailFilterStatus !== 'all' && lr.status !== detailFilterStatus) return false;
      
      // Active leave filter
      if (detailFilterActive) {
        if (lr.status !== 'approved') return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const start = new Date(lr.startDate);
        start.setHours(0, 0, 0, 0);
        const end = getEndDate(lr.startDate, lr.duration);
        if (end) end.setHours(23, 59, 59, 999);
        if (today < start || (end && today > end)) return false;
      }
      
      // Start date filter (exact match)
      if (detailFilterStartDate) {
        const lrDateStr = new Date(lr.startDate).toISOString().split('T')[0];
        if (lrDateStr !== detailFilterStartDate) return false;
      }
      
      return true;
    });
  }, [leaveRequests, detailFilterStatus, detailFilterActive, detailFilterStartDate]);

  return (
    <div className="leave-dashboard">
      <Header />

      <main className="container-fluid px-3 px-md-4 py-4 py-md-5">
        {/* Liste des employés */}
        <div className="section-card section-pad mb-4">
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-4">
            <h2 className="section-title list-title mb-0">Employés</h2>
            <div className="d-flex flex-wrap gap-2">
              <input
                type="text"
                className="form-control filter-input emp-search"
                placeholder="Rechercher par nom ou email"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                className="form-select filter-select emp-role"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="all">Tous les rôles</option>
                <option value="employee">Employé</option>
                <option value="head">Chef</option>
                <option value="hr">RH</option>
              </select>
            </div>
          </div>

          {listError && (
            <div className="alert alert-danger py-2 small" role="alert">
              {listError}
            </div>
          )}

          {loadingList ? (
            <div className="loading-state" role="status">
              <span className="spinner-border spinner-border-sm" aria-hidden="true" />
              Chargement...
            </div>
          ) : filteredEmployees.length === 0 ? (
            <p className="empty-state mb-0">Aucun employé ne correspond à cette recherche.</p>
          ) : (
            <div className="table-responsive">
              <table className="table align-middle employee-table">
                <thead>
                  <tr>
                    <th>Matricule</th>
                    <th>Nom</th>
                    <th>Email</th>
                    <th>Rôle</th>
                    <th>Unité</th>
                    <th>Type d'unité</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((emp) => (
                    <tr key={emp.id}>
                      <td className="fw-medium text-nowrap">{emp.matricule ?? '—'}</td>
                      <td>
                        <div className="emp-row-name">
                          <Avatar id={emp.id} firstName={emp.firstName} lastName={emp.lastName} />
                          <span className="fw-medium">{emp.firstName} {emp.lastName}</span>
                        </div>
                      </td>
                      <td className="muted-note">{emp.email}</td>
                      <td><span className="role-chip">{emp.roleLabel ?? ROLE_LABELS[emp.role] ?? emp.role}</span></td>
                      <td>{emp.unit?.name ?? '—'}</td>
                      <td>{emp.unit?.type ?? '—'}</td>
                      <td className="text-end text-nowrap">
                        {currentUser?.canCreateForEmployee && emp.role === 'employee' && (
                          <button
                            className="btn btn-sm btn-brand me-2"
                            onClick={() => {
                              setRequestTargetId(emp.id);
                              setRequestTargetName(`${emp.firstName} ${emp.lastName}`);
                            }}
                          >
                            Démarrer une demande
                          </button>
                        )}
                        <button className="btn btn-sm view-btn" onClick={() => handleViewDetails(emp.id)}>
                          Voir détails
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Détails employé sélectionné */}
        {selectedId && (
          <div className="section-card overflow-hidden">
            <div className="detail-panel-header d-flex align-items-center justify-content-between">
              <div className="d-flex align-items-center gap-3">
                {detail && <Avatar id={detail.id} firstName={detail.firstName} lastName={detail.lastName} size={48} />}
                <div>
                  <h2 className="h5 fw-bold mb-0">
                    {detail ? `${detail.firstName} ${detail.lastName}` : "Détails de l'employé"}
                  </h2>
                  {detail && <p className="muted-note mb-0">{detail.roleLabel ?? ROLE_LABELS[detail.role] ?? detail.role}</p>}
                </div>
              </div>
              <button className="btn btn-sm close-btn" onClick={closeDetails}>
                Fermer
              </button>
            </div>

            <div className="section-pad">
              {detailError && (
                <div className="alert alert-danger py-2 small" role="alert">
                  {detailError}
                </div>
              )}

              {detailLoading ? (
                <div className="loading-state" role="status">
              <span className="spinner-border spinner-border-sm" aria-hidden="true" />
              Chargement...
            </div>
              ) : detail ? (
                <>
                  <div className="row g-3 mb-4">
                    <div className="col-12 col-sm-6 col-md-4">
                      <p className="muted-note mb-1">Matricule</p>
                      <p className="fw-medium mb-0">{detail.matricule ?? '—'}</p>
                    </div>
                    <div className="col-12 col-sm-6 col-md-4">
                      <p className="muted-note mb-1">Email</p>
                      <p className="fw-medium mb-0">{detail.email}</p>
                    </div>
                    <div className="col-12 col-sm-6 col-md-4">
                      <p className="muted-note mb-1">Unité</p>
                      <p className="fw-medium mb-0">{detail.unit?.name ?? '—'}</p>
                    </div>
                    <div className="col-12 col-sm-6 col-md-4">
                      <p className="muted-note mb-1">Type d'unité</p>
                      <p className="fw-medium mb-0">{detail.unit?.type ?? '—'}</p>
                    </div>
                    <div className="col-12 col-sm-6 col-md-4">
                      <p className="muted-note mb-1">Date de recrutement</p>
                      <p className="fw-medium mb-0">{formatDate(detail.recrutement_date)}</p>
                    </div>
                  </div>

                  <h3 className="section-title mb-3">Exercices</h3>
                  {activeExercises.length === 0 ? (
                    <p className="empty-state mb-4">Aucun solde disponible.</p>
                  ) : (
                    <div className="row g-3 mb-4">
                      {activeExercises.map((ex, index) => (
                        <div className="col-12 col-sm-6 col-md-4" key={index}>
                          <div className="exercise-card h-100">
                            <p className="muted-note mb-1">Exercice</p>
                            <p className="fw-medium mb-3">{ex.exercise}</p>
                            <p className="muted-note mb-1">Solde</p>
                            <p className="exercise-balance mb-0">{ex.balance} j</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
                    <h3 className="section-title mb-0">Historique des demandes</h3>
                    <div className="d-flex flex-wrap gap-2 align-items-center">
                      <div className="form-check form-switch me-2 d-flex align-items-center gap-2" style={{ margin: 0 }}>
                        <input className="form-check-input mt-0" type="checkbox" role="switch" id="empActiveLeaveSwitch" checked={detailFilterActive} onChange={(e) => setDetailFilterActive(e.target.checked)} />
                        <label className="form-check-label small fw-medium" htmlFor="empActiveLeaveSwitch">Congés actifs</label>
                      </div>
                      <input type="date" className="form-control filter-input" value={detailFilterStartDate} onChange={(e) => setDetailFilterStartDate(e.target.value)} title="Date de début exacte" />
                      <select className="form-select filter-select" value={detailFilterStatus} onChange={(e) => setDetailFilterStatus(e.target.value)}>
                        <option value="all">Tous statuts</option>
                        <option value="pending">En attente</option>
                        <option value="approved">Approuvée</option>
                        <option value="rejected">Refusée</option>
                        <option value="cancelled">Annulée</option>
                        <option value="time out">Expirée</option>
                      </select>
                    </div>
                  </div>
                  {filteredLeaveRequests.length === 0 ? (
                    <p className="empty-state mb-0">Aucune demande de congé correspondante.</p>
                  ) : (
                    <div className="table-responsive">
                      <table className="table align-middle history-table">
                        <thead>
                          <tr>
                            <th>Type</th>
                            <th>Dates</th>
                            <th>Durée</th>
                            <th>Statut</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredLeaveRequests.map((lr) => {
                            const endDate = getEndDate(lr.startDate, lr.duration);
                            return (
                              <tr key={lr.id}>
                                <td>{LEAVE_TYPE_LABELS[lr.type] ?? lr.type}</td>
                                <td>
                                  {formatDate(lr.startDate)}
                                  {endDate ? ` → ${formatDate(endDate)}` : ''}
                                </td>
                                <td>{lr.duration} j</td>
                                <td><StatusBadge status={lr.status} /></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>
        )}
      </main>

      {requestTargetId && (
        <LeaveRequestModal
          targetEmployeeId={requestTargetId}
          targetEmployeeName={requestTargetName}
          onClose={() => {
            setRequestTargetId(null);
            setRequestTargetName('');
          }}
          onSuccess={() => window.location.reload()}
        />
      )}
    </div>
  );
}

export default EmployeesDashboard;