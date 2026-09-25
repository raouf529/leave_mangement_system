import { useState, useEffect, useMemo, Fragment } from 'react';
import api from './api';
import Header from './header';
import LeaveRequestModal from './LeaveRequestModal';
import './dashboard.css';
// this page where employee information and can send leave request and see the status of leave request

async function getInformation() {
  const response = await api.get('/profile/me');
  return response.data;
}

async function cancelRequest(requestId) {
  const response = await api.patch(`/request/${requestId}/cancel`, {});
  return response.data;
}

const LEAVE_TYPE_LABELS = {
  annual: 'Congé annuel',
  exceptional: 'Congé exceptionnel',
  advance: 'Avance sur congé'
};

const ROLE_LABELS = {
  employe: 'Employé',
  chef_service: 'Chef de service',
  chef_departement: 'Chef de département',
  directeur: 'Directeur',
  drh: 'DRH'
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

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('fr-FR');
}

// Exercise.year is the fiscal start year. Example: 2025 means 01/07/2025 to 30/06/2026.
function getExerciseRange(exerciseLabel) {
  const startYear = parseInt(exerciseLabel, 10);
  if (Number.isNaN(startYear)) return null;
  const endYear = startYear + 1;
  return {
    startYear,
    endYear,
    from: `01/07/${startYear}`,
    to: `30/06/${endYear}`
  };
}

function isCurrentExercise(exerciseLabel) {
  const range = getExerciseRange(exerciseLabel);
  if (!range) return false;
  const today = new Date();
  const start = new Date(range.startYear, 6, 1); // July 1
  const end = new Date(range.endYear, 5, 30); // June 30
  return today >= start && today <= end;
}

// Fallback when the API doesn't send the exercise's initial entitlement
const DEFAULT_EXERCISE_DAYS = 30;

function getBalanceHealth(balance, total) {
  const safeTotal = total > 0 ? total : DEFAULT_EXERCISE_DAYS;
  const pct = Math.max(0, Math.min(100, (Number(balance) / safeTotal) * 100));
  const level = pct >= 60 ? 'high' : pct >= 30 ? 'medium' : 'low';
  const LABELS = { high: 'Solde confortable', medium: 'Solde moyen', low: 'Solde bas' };
  return { pct, level, label: LABELS[level], total: safeTotal };
}

function getEndDate(startDate, duration) {
  if (!startDate) return null;
  const d = new Date(startDate);
  d.setDate(d.getDate() + (Number(duration) || 0));
  return d;
}

function getCurrentStepLabel(lr) {
  if (!lr?.currentStep) return null;
  if (lr.currentStep.kind === 'hr') return 'HR';
  if (lr.currentStep.kind === 'unit') return `${lr.currentStep.unitName ?? 'Unité'} (${lr.currentStep.unitType ?? 'unit'})`;
  return lr.currentStep.targetName;
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

function Dashboard() {
  const [employeeInfo, setEmployeeInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [cancelingId, setCancelingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  
  // Filters for request history
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterActive, setFilterActive] = useState(false);

  const [confirmCancelRequest, setConfirmCancelRequest] = useState(null);

  function toggleDetails(requestId) {
    setExpandedId((prev) => (prev === requestId ? null : requestId));
  }

  function promptCancel(request) {
    setConfirmCancelRequest(request);
  }

  async function handleConfirmCancel() {
    if (!confirmCancelRequest) return;
    const requestId = confirmCancelRequest.id;
    setCancelingId(requestId);
    try {
      await cancelRequest(requestId);
      // Refetch employee profile to refresh balance & request list correctly
      const updatedInfo = await getInformation();
      setEmployeeInfo(updatedInfo);
      setError('');
      setConfirmCancelRequest(null);
    } catch (err) {
      console.error('Error cancelling request:', err);
      setError(err.response?.data?.error ?? 'Impossible d\'annuler cette demande.');
    } finally {
      setCancelingId(null);
    }
  }

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await getInformation();
        setEmployeeInfo(data);
      } catch (err) {
        console.error('Error fetching employee information:', err);
        setError("Impossible de charger vos informations.");
      } finally {
        setLoading(false);
      }
    }
    fetchData();

    // Logout does a hard window.location.replace('/'), which makes this
    // page's prior document instance bfcache-eligible. If the user then
    // hits Forward, the browser can restore that old instance instead of
    // remounting -> no refetch, stale authenticated content briefly shown.
    // Re-verify on that restore; a 401 here gets the axios interceptor to
    // redirect to '/'.
    function handlePageShow(event) {
      if (event.persisted) fetchData();
    }
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, []);

  const activeExercises = (employeeInfo?.exercises ?? []).filter(
    (ex) => Number(ex.balance) > 0
  );
  // Total of the closed exercises only (the current exercise is not counted)
  const pastExercisesBalance = activeExercises
    .filter((ex) => !isCurrentExercise(ex.exercise))
    .reduce((sum, ex) => sum + Number(ex.balance || 0), 0);
  const rawRequests = employeeInfo?.leaveRequests ?? [];
  // Sort from oldest to newest using created_at (or id as fallback)
  const leaveRequests = [...rawRequests].sort((a, b) => {
    const timeA = a.created_at ? new Date(a.created_at).getTime() : a.id;
    const timeB = b.created_at ? new Date(b.created_at).getTime() : b.id;
    return timeA - timeB;
  });

  // The hero card only ever needs to surface a request that's still awaiting a
  // decision — anything resolved (approved/rejected/cancelled) already lives in
  // the history table below, so showing it twice adds nothing.
  const pendingRequest = rawRequests.find((lr) => lr.status === 'pending') ?? null;

  const filteredLeaveRequests = useMemo(() => {
    return leaveRequests.filter((lr) => {
      // Status filter
      if (filterStatus !== 'all' && lr.status !== filterStatus) return false;
      
      // Active leave filter
      if (filterActive) {
        if (lr.status !== 'approved') return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0); // ignore time for comparison
        const start = new Date(lr.startDate);
        start.setHours(0, 0, 0, 0);
        const end = getEndDate(lr.startDate, lr.duration);
        if (end) end.setHours(23, 59, 59, 999);
        if (today < start || (end && today > end)) return false;
      }
      
      // Start date filter (exact match)
      if (filterStartDate) {
        // Just compare the YYYY-MM-DD strings
        const lrDateStr = new Date(lr.startDate).toISOString().split('T')[0];
        if (lrDateStr !== filterStartDate) return false;
      }
      
      return true;
    });
  }, [leaveRequests, filterStatus, filterActive, filterStartDate]);

  const pendingRequestEndDate = pendingRequest ? getEndDate(pendingRequest.startDate, pendingRequest.duration) : null;
  const pendingRequestStepLabel = getCurrentStepLabel(pendingRequest);
  return (
    <div className="leave-dashboard">
      <Header
        EmployeeName={employeeInfo ? `${employeeInfo.firstName} ${employeeInfo.lastName}` : ''}
        EmployeeRole={employeeInfo ? employeeInfo.role : ''}
        EmployeeRoleLabel={employeeInfo ? employeeInfo.roleLabel : ''}
        onRequestLeave={() => setShowRequestModal(true)}
      />

      <main className="container py-4">
        {/* Primary CTA lives right beside the page title on every breakpoint now —
            previously it only appeared here on mobile (d-lg-none) and was otherwise
            buried in the sidebar, which made it easy to miss. */}
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
          <div className="d-flex flex-wrap align-items-baseline gap-2 gap-md-3">
            <h1 className="page-title mb-0">
              Bonjour{employeeInfo ? `, ${employeeInfo.firstName}` : ''}
            </h1>
            <span className="hero-label">Espace employé</span>
          </div>
          <button
            className="btn btn-brand btn-request-main px-4"
            onClick={() => setShowRequestModal(true)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Demander un congé
          </button>
        </div>

        {error && (
          <div className="alert alert-danger py-2 small" role="alert">
            {error}
          </div>
        )}

        {loading ? (
          <div className="loading-state" role="status">
            <span className="spinner-border spinner-border-sm" aria-hidden="true" />
            Chargement...
          </div>
        ) : (
          <>
            {/* Only rendered when a request is actually awaiting a decision — an
                approved/rejected/cancelled request is resolved and already shows
                in the history table, so there's nothing useful to repeat here,
                and no "no pending request" placeholder is shown either. */}
            {pendingRequest && (
              <section
                className="section-card mb-4 last-request-card"
                style={{ '--status-color': STATUS_STYLES.pending.fg }}
              >
                <p className="last-request-label mb-2">Demande en cours</p>
                <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
                  <h2 className="section-title mb-0">{LEAVE_TYPE_LABELS[pendingRequest.leaveType] ?? pendingRequest.leaveType}</h2>
                  <StatusBadge status={pendingRequest.status} />
                </div>

                <div className="row g-3 mb-3">
                  <div className="col-12 col-sm-6 col-md-4">
                    <p className="hero-label mb-1">Dates</p>
                    <p className="fw-medium mb-0">
                      {formatDate(pendingRequest.startDate)}
                      {pendingRequestEndDate ? ` → ${formatDate(pendingRequestEndDate)}` : ''}
                    </p>
                  </div>
                  <div className="col-12 col-sm-6 col-md-4">
                    <p className="hero-label mb-1">Durée</p>
                    <p className="fw-medium mb-0">{pendingRequest.duration} j</p>
                  </div>
                  {pendingRequestStepLabel && (
                    <div className="col-12 col-md-4">
                      <p className="hero-label mb-1">En attente de</p>
                      <p className="fw-medium mb-0">{pendingRequestStepLabel}</p>
                    </div>
                  )}
                </div>

                {['annual', 'advance'].includes(pendingRequest.leaveType) && pendingRequest.allocations?.length > 0 && (
                  <div className="mb-3">
                    <p className="hero-label mb-2">Répartition</p>
                    <div className="split-list">
                      {pendingRequest.allocations.map((a, i) => (
                        <div key={i} className="mb-1">Exercice {a.year} : {a.daysAllocated} j</div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  className="btn btn-sm cancel-btn"
                  disabled={cancelingId === pendingRequest.id}
                  onClick={() => promptCancel(pendingRequest)}
                >
                  {cancelingId === pendingRequest.id ? 'Annulation...' : 'Annuler cette demande'}
                </button>
              </section>
            )}

            <section className="section-card mb-4">
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
                <h2 className="section-title mb-0">Exercices</h2>
                {activeExercises.length > 0 && (
                  <div className="total-balance">
                    <span className="total-balance-label">Total hors exercice en cours</span>
                    <span className="total-balance-value">
                      {Number(pastExercisesBalance.toFixed(2))} {pastExercisesBalance > 1 ? 'jours' : 'jour'}
                    </span>
                  </div>
                )}
              </div>
              {activeExercises.length === 0 ? (
                <p className="empty-state mb-0">Aucun solde disponible pour le moment.</p>
              ) : (
                <div className="row g-3">
                  {activeExercises.map((exercise, index) => {
                    const range = getExerciseRange(exercise.exercise);
                    const current = isCurrentExercise(exercise.exercise);
                    const health = getBalanceHealth(
                      exercise.balance,
                      Number(exercise.total ?? exercise.allocated ?? exercise.initialBalance)
                    );
                    return (
                      <div className="col-12 col-sm-6 col-md-4" key={index}>
                        <div className={`exercise-card h-100${current ? ' current' : ''}`}>
                          <div className="d-flex flex-wrap justify-content-between align-items-start gap-2">
                            <p className="exercise-name mb-0">
                              {range ? `Exercice ${range.startYear} / ${range.endYear}` : exercise.exercise}
                            </p>
                            {current && <span className="current-pill">Exercice en cours</span>}
                          </div>
                          {range && <p className="muted-note mb-0 mt-1">Du {range.from} au {range.to}</p>}
                          <p className="exercise-balance mb-0">
                            {exercise.balance}{' '}
                            <span className="exercise-unit">/ {health.total} jours</span>
                          </p>
                          {!current && (
                            <span className={`balance-chip balance-chip-${health.level}`}>
                              {health.label}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="section-card">
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
                <h2 className="section-title mb-0">
                  Historique des demandes
                  <span className="count-pill">{filteredLeaveRequests.length}</span>
                </h2>
                <div className="d-flex flex-wrap gap-2 align-items-center">
                  <div className="form-check form-switch me-2 d-flex align-items-center gap-2" style={{ margin: 0 }}>
                    <input className="form-check-input mt-0" type="checkbox" role="switch" id="activeLeaveSwitch" checked={filterActive} onChange={(e) => setFilterActive(e.target.checked)} />
                    <label className="form-check-label small fw-medium" htmlFor="activeLeaveSwitch">Congés actifs</label>
                  </div>
                  <input type="date" className="form-control filter-input" value={filterStartDate} onChange={(e) => setFilterStartDate(e.target.value)} title="Date de début exacte" />
                  <select className="form-select filter-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
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
                  <table className="history-table table align-middle mb-0">
                    <thead>
                      <tr>
                        <th style={{ width: '26%' }}>Type</th>
                        <th style={{ width: '18%' }}>Période</th>
                        <th style={{ width: '10%' }}>Durée</th>
                        <th style={{ width: '26%' }}>Statut</th>
                        <th className="text-end" style={{ width: '20%' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLeaveRequests.map((lr) => {
                        const endDate = getEndDate(lr.startDate, lr.duration);
                        const currentStepLabel = getCurrentStepLabel(lr);
                        const rejectionNote = lr.status === 'rejected' ? (lr.rejectionReason || 'Aucune raison détaillée.') : null;
                        const annualSplit = lr.leaveType === 'annual' && lr.allocations?.length
                          ? lr.allocations.map((allocation) => `Exercice ${allocation.year} : ${allocation.daysAllocated} j`).join(' · ')
                          : null;
                        const hasDetails = Boolean(annualSplit || (lr.status === 'pending' && currentStepLabel) || rejectionNote || lr.createdByName);
                        const isExpanded = expandedId === lr.id;

                        return (
                          <Fragment key={lr.id}>
                            <tr>
                              <td>
                                <div className="fw-medium">{LEAVE_TYPE_LABELS[lr.leaveType] ?? lr.leaveType}</div>
                                {lr.created_at && <div className="cell-sub">Demandée le {formatDate(lr.created_at)}</div>}
                              </td>
                              <td className="text-nowrap">
                                <div className="fw-medium">{formatDate(lr.startDate)}</div>
                                {endDate && <div className="cell-sub">→ {formatDate(endDate)}</div>}
                              </td>
                              <td><span className="duration-pill">{lr.duration} j</span></td>
                              <td>
                                <StatusBadge status={lr.status} />
                                {lr.status === 'pending' && currentStepLabel && (
                                  <div className="cell-sub mt-1">Chez : {currentStepLabel}</div>
                                )}
                              </td>
                              <td>
                                <div className="d-flex flex-wrap justify-content-end gap-2">
                                  {hasDetails && (
                                    <button
                                      className="btn btn-sm info-btn chevron-btn"
                                      onClick={() => toggleDetails(lr.id)}
                                      aria-expanded={isExpanded}
                                      aria-label={isExpanded ? 'Masquer les détails' : 'Plus d\'infos'}
                                      title={isExpanded ? 'Masquer les détails' : 'Plus d\'infos'}
                                    >
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 150ms ease' }} aria-hidden="true">
                                        <polyline points="6 9 12 15 18 9" />
                                      </svg>
                                    </button>
                                  )}
                                  <button
                                    className="btn btn-sm cancel-btn"
                                    disabled={cancelingId === lr.id || lr.status === 'cancelled' || lr.status === 'rejected'}
                                    onClick={() => promptCancel(lr)}
                                  >
                                    {cancelingId === lr.id ? 'Annulation...' : 'Annuler'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr className="detail-row">
                                <td colSpan={5}>
                                  <div className="detail-grid">
                                    {annualSplit && (
                                      <div className="detail-item">
                                        <span className="detail-label">Répartition</span>
                                        <span className="detail-value">{annualSplit}</span>
                                      </div>
                                    )}
                                    {lr.status === 'pending' && currentStepLabel && (
                                      <div className="detail-item">
                                        <span className="detail-label">Étape actuelle</span>
                                        <span className="detail-value">{currentStepLabel}</span>
                                      </div>
                                    )}
                                    {rejectionNote && (
                                      <div className="detail-item">
                                        <span className="detail-label">Motif du refus</span>
                                        <span className="detail-value" style={{ color: 'var(--danger)' }}>{rejectionNote}</span>
                                      </div>
                                    )}
                                    {lr.status === 'rejected' && lr.rejectedByName && (
                                      <div className="detail-item">
                                        <span className="detail-label">Refusée par</span>
                                        <span className="detail-value" style={{ color: 'var(--danger)' }}>
                                          {lr.rejectedByName}{lr.rejectedByRole ? ` (${lr.rejectedByRole})` : ''}
                                        </span>
                                      </div>
                                    )}
                                    {lr.createdByName && (
                                      <div className="detail-item">
                                        <span className="detail-label">Créée par</span>
                                        <span className="detail-value">
                                          {lr.createdByName}{lr.createdByRole ? ` (${ROLE_LABELS[lr.createdByRole] ?? lr.createdByRole})` : ''}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {confirmCancelRequest && (
        <div className="custom-modal-backdrop" onClick={() => setConfirmCancelRequest(null)}>
          <div className="custom-modal p-4" onClick={(e) => e.stopPropagation()}>
            <div className="d-flex align-items-center gap-3 mb-3">
              <div className="confirm-icon" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
              </div>
              <h5 className="mb-0 fw-bold">Confirmer l'annulation</h5>
            </div>
            
            <p className="mb-3 text-secondary" style={{ fontSize: '0.95rem', lineHeight: '1.5' }}>
              Êtes-vous sûr de vouloir annuler cette demande de congé ?
            </p>

            {confirmCancelRequest.status === 'approved' && (
              <div className="warn-note mb-3">
                <strong>Attention :</strong> Cette demande est déjà <strong>approuvée</strong>.
                Si vous l'annulez, l'annulation repartira du début dans la chaîne de validation (circuit de signature), et le solde de jours ne sera restitué qu'une fois l'annulation validée.
              </div>
            )}

            <div className="d-flex justify-content-end gap-2 mt-4">
              <button
                type="button"
                className="btn btn-outline-neutral px-4"
                onClick={() => setConfirmCancelRequest(null)}
                disabled={Boolean(cancelingId)}
              >
                Retour
              </button>
              <button
                type="button"
                className="btn btn-danger-solid px-4"
                onClick={handleConfirmCancel}
                disabled={Boolean(cancelingId)}
              >
                {cancelingId ? 'Annulation...' : 'Confirmer l\'annulation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRequestModal && (
        <LeaveRequestModal
          onClose={() => setShowRequestModal(false)}
          onSuccess={() => window.location.reload()}
        />
      )}
    </div>
  );
}

export default Dashboard;