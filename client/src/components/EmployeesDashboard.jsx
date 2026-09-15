import { useState, useEffect, useMemo, useRef } from 'react';
import api from './api';
import Header from './header';
import useCurrentUser from '../hooks/useCurrentUser';

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

const AVATAR_PALETTE = ['#1F5673', '#C98A2C', '#3E8A5F', '#6C5CE7', '#C1544A', '#2D9CDB'];

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
  const { role: currentRole, loading: currentUserLoading } = useCurrentUser();

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const detailRequestRef = useRef(0);

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

  return (
    <div className="leave-dashboard">
      <style>{`
        .leave-dashboard {
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
        .hero-strip { background: var(--surface); border-bottom: 1px solid var(--border); }
        .hero-label { color: var(--muted); font-size: 0.85rem; }
        .stat-block { min-width: 88px; }
        .stat-number { font-size: 1.6rem; font-weight: 700; color: var(--primary); line-height: 1; }
        .stat-number.employee { color: var(--ink); }
        .stat-number.head { color: var(--accent-amber); }
        .stat-number.hr { color: var(--success); }
        .stat-label { color: var(--muted); font-size: 0.78rem; margin-top: 2px; }
        .section-card { background: var(--surface); border-radius: 14px; border: 1px solid var(--border); }
        .section-title { font-size: 1.05rem; font-weight: 600; color: var(--ink); }
        .muted-note { font-size: 0.82rem; color: var(--muted); }
        .status-badge { display: inline-flex; align-items: center; gap: 6px; padding: 0.3rem 0.65rem; border-radius: 999px; font-size: 0.8rem; font-weight: 600; }
        .status-dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; }
        .role-chip { background: var(--primary-soft); color: var(--primary); padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.8rem; font-weight: 600; }
        .exercise-card { border-left: 3px solid #D8DEE5; background: #FAFBFC; border-radius: 10px; padding: 1rem 1.1rem; }
        .exercise-balance { font-size: 1.5rem; font-weight: 700; color: var(--primary); }
        .filter-input, .filter-select { border: 1px solid var(--border); border-radius: 10px; }
        .filter-input:focus, .filter-select:focus { border-color: var(--primary); box-shadow: 0 0 0 0.2rem rgba(31, 86, 115, 0.15); }
        .view-btn { border: 1px solid var(--primary); color: var(--primary); background: #fff; border-radius: 10px; }
        .view-btn:hover { background: var(--primary-soft); }
        .close-btn { border: none; background: #F2F5F8; color: var(--muted); border-radius: 10px; }
        .avatar-chip {
          display: inline-flex; align-items: center; justify-content: center;
          border-radius: 50%; color: #fff; font-weight: 700; flex-shrink: 0;
        }
        .emp-row-name { display: flex; align-items: center; gap: 10px; }
        .detail-panel-header {
          background: var(--primary-soft); border-radius: 14px 14px 0 0;
          margin: -1px -1px 0 -1px;
          padding: 1.5rem 1.5rem 1.25rem;
        }
        table.employee-table tbody tr:hover { background: #FAFBFC; }
      `}</style>

      <Header />

      
        

      <main className="container py-4 py-md-5">
        {/* Liste des employés */}
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
                    <th>Type d'unité</th>
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
                      <td><span className="role-chip">{emp.roleLabel ?? ROLE_LABELS[emp.role] ?? emp.role}</span></td>
                      <td>{emp.unit?.name ?? '—'}</td>
                      <td>{emp.unit?.type ?? '—'}</td>
                      <td className="text-end">
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

            <div className="p-4 p-md-5">
              {detailError && (
                <div className="alert alert-danger py-2 small" role="alert">
                  {detailError}
                </div>
              )}

              {detailLoading ? (
                <div className="text-center muted-note py-5">Chargement...</div>
              ) : detail ? (
                <>
                  <div className="row g-3 mb-4">
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
                    <p className="muted-note">Aucun solde disponible.</p>
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

                  <h3 className="section-title mb-3">Historique des demandes</h3>
                  {leaveRequests.length === 0 ? (
                    <p className="muted-note mb-0">Aucune demande de congé.</p>
                  ) : (
                    <div className="table-responsive">
                      <table className="table align-middle">
                        <thead>
                          <tr className="muted-note text-uppercase">
                            <th>Type</th>
                            <th>Dates</th>
                            <th>Durée</th>
                            <th>Statut</th>
                          </tr>
                        </thead>
                        <tbody>
                          {leaveRequests.map((lr) => {
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
    </div>
  );
}

export default EmployeesDashboard;