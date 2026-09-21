import { useState, useEffect, useMemo, Fragment } from 'react';
import api from './api';
import Header from './header';
import LeaveRequestModal from './LeaveRequestModal';
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

  // Last request is the newest request based on created_at
  const lastRequest = rawRequests.length > 0
    ? [...rawRequests].sort((a, b) => {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : a.id;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : b.id;
        return timeB - timeA;
      })[0]
    : null;

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

  const lastRequestEndDate = lastRequest ? getEndDate(lastRequest.startDate, lastRequest.duration) : null;
  const lastRequestStepLabel = getCurrentStepLabel(lastRequest);
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
          --primary-hover: #184559;
          --primary-soft: #E8F0F4;
          --accent-amber: #8A5300;
          --amber-soft: #FFF3D6;
          --success: #13694D;
          --success-soft: #DDF3EA;
          --danger: #B03A2E;
          --danger-soft: #FBEBE9;
          --neutral-soft: #EEF1F4;
          min-height: 100vh;
          background: var(--canvas);
          color: var(--ink);
          font-variant-numeric: tabular-nums;
        }
        .leave-dashboard :focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }

        /* Typography: page title > section title > body */
        .leave-dashboard .page-title { font-size: 1.6rem; font-weight: 700; letter-spacing: -0.01em; color: var(--ink); }
        .hero-label { color: var(--muted); font-size: 0.875rem; }
        .section-title { font-size: 1.125rem; font-weight: 600; color: var(--ink); }
        .muted-note { font-size: 0.9rem; color: var(--muted); }

        /* Cards */
        .section-card {
          position: relative;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 14px;
          box-shadow: 0 1px 2px rgba(27, 36, 48, 0.05);
          padding: 1.25rem;
        }
        @media (min-width: 768px) { .section-card { padding: 1.75rem; } }

        .last-request-card { overflow: hidden; }
        .last-request-card::before {
          content: '';
          position: absolute; top: 0; bottom: 0; left: 0; width: 4px;
          background: var(--status-color, var(--border));
        }
        .last-request-card .section-title { font-size: 1.35rem; }
        .last-request-label { font-size: 0.85rem; font-weight: 600; color: var(--muted); }
        .reject-note {
          background: var(--danger-soft); color: var(--danger);
          border: 1px solid #EBC5C0; border-radius: 10px;
          padding: 0.85rem 1rem; font-size: 0.92rem; line-height: 1.5;
        }
        .split-list { font-size: 0.95rem; }

        /* Exercise balances */
        .total-balance {
          display: inline-flex; align-items: baseline; gap: 0.6rem;
          padding: 0.4rem 0.9rem; border-radius: 999px;
          background: var(--primary-soft);
        }
        .total-balance-label { font-size: 0.875rem; color: var(--muted); }
        .total-balance-value { font-size: 1.05rem; font-weight: 700; color: var(--primary); }
        .exercise-card {
          display: flex; flex-direction: column;
          border: 1px solid var(--border); background: var(--surface);
          border-radius: 12px; padding: 1.25rem;
        }
        .exercise-card.current { border-color: var(--primary); background: var(--primary-soft); }
        .exercise-name { font-weight: 600; color: var(--ink); }
        .exercise-balance {
          margin-top: auto; padding-top: 1rem;
          font-size: 2.1rem; font-weight: 700; line-height: 1; color: var(--primary);
        }
        .exercise-unit { margin-left: 0.15rem; font-size: 0.95rem; font-weight: 500; color: var(--muted); }
        .current-pill {
          display: inline-block; padding: 0.15rem 0.6rem; border-radius: 999px;
          background: var(--primary); color: #fff; font-size: 0.75rem; font-weight: 600; white-space: nowrap;
        }

        /* Status badge */
        .status-badge {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 0.25rem 0.7rem; border-radius: 999px;
          font-size: 0.82rem; font-weight: 600; white-space: nowrap;
        }
        .status-dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; }

        /* Buttons (explicit hover/disabled states so Bootstrap defaults don't leak in) */
        .leave-dashboard .btn { border-radius: 9px; }
        .leave-dashboard .btn-brand { background: var(--primary); color: #fff; border: 1px solid var(--primary); font-weight: 500; }
        .leave-dashboard .btn-brand:hover:not(:disabled) { background: var(--primary-hover); border-color: var(--primary-hover); color: #fff; }
        .leave-dashboard .info-btn,
        .leave-dashboard .cancel-btn {
          border: 1px solid var(--border); background: var(--surface);
          font-size: 0.85rem; font-weight: 500; white-space: nowrap;
        }
        .leave-dashboard .info-btn { color: var(--primary); }
        .leave-dashboard .info-btn:hover { background: var(--primary-soft); border-color: var(--primary-soft); color: var(--primary); }
        .leave-dashboard .cancel-btn { color: var(--ink); }
        .leave-dashboard .cancel-btn:hover:not(:disabled) { background: var(--danger-soft); border-color: #EBC5C0; color: var(--danger); }
        .leave-dashboard .cancel-btn:disabled { opacity: 0.45; }
        .leave-dashboard .btn-outline-neutral { border: 1px solid var(--border); background: var(--surface); color: var(--ink); }
        .leave-dashboard .btn-outline-neutral:hover:not(:disabled) { background: var(--canvas); color: var(--ink); }
        .leave-dashboard .btn-danger-solid { background: var(--danger); color: #fff; border: 1px solid var(--danger); font-weight: 500; }
        .leave-dashboard .btn-danger-solid:hover:not(:disabled) { background: #952F25; border-color: #952F25; color: #fff; }

        /* Filters and form controls */
        .filter-input, .filter-select { width: 150px; font-size: 0.875rem; }
        @media (max-width: 575.98px) {
          .filter-input, .filter-select { width: 100%; flex: 1 1 140px; }
        }
        .leave-dashboard .form-control,
        .leave-dashboard .form-select { border-color: #CDD4DC; border-radius: 10px; color: var(--ink); }
        .leave-dashboard .form-control:focus,
        .leave-dashboard .form-select:focus { border-color: var(--primary); box-shadow: 0 0 0 0.2rem rgba(31, 86, 115, 0.16); }
        .leave-dashboard .form-check-input:checked { background-color: var(--primary); border-color: var(--primary); }
        .leave-dashboard .form-check-input:focus { border-color: var(--primary); box-shadow: 0 0 0 0.2rem rgba(31, 86, 115, 0.16); }

        /* History table */
        .leave-dashboard .table-responsive { border: 1px solid var(--border); border-radius: 12px; }
        .history-table { --bs-table-bg: transparent; font-size: 0.93rem; }
        .history-table thead th {
          font-size: 0.8rem; font-weight: 600; color: var(--muted);
          padding: 0.75rem 1rem; background: var(--canvas);
          border-bottom: 1px solid var(--border); white-space: nowrap;
        }
        .history-table td { padding: 0.85rem 1rem; border-color: var(--border); }
        .history-table tbody tr:last-child > td { border-bottom: none; }
        .history-table.table > tbody > tr:not(.detail-row):hover > td { background: #FAFBFC; }
        .history-table .detail-row > td { background: var(--canvas); padding-top: 0.9rem; padding-bottom: 1.1rem; }
        .detail-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.85rem 1.5rem; }
        .detail-item { display: flex; flex-direction: column; gap: 0.15rem; }
        .detail-label { font-size: 0.78rem; font-weight: 600; color: var(--muted); }
        .detail-value { font-size: 0.92rem; color: var(--ink); }

        /* Empty, loading, alerts */
        .empty-state {
          text-align: center; color: var(--muted); font-size: 0.92rem;
          padding: 1.75rem 1rem; border: 1px dashed #CDD4DC; border-radius: 12px; background: var(--canvas);
        }
        .loading-state { display: flex; align-items: center; justify-content: center; gap: 0.6rem; padding: 3rem 0; color: var(--muted); }
        .leave-dashboard .alert-danger {
          background: var(--danger-soft); color: var(--danger);
          border: 1px solid #EBC5C0; border-radius: 10px;
        }

        /* Cancel confirmation modal */
        .custom-modal-backdrop {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(27, 36, 48, 0.5);
          backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center;
          z-index: 1050;
        }
        .custom-modal {
          background: var(--surface);
          border-radius: 16px;
          box-shadow: 0 20px 40px -12px rgba(27, 36, 48, 0.25);
          max-width: 480px; width: 90%;
          overflow: hidden;
          animation: modalAppear 0.2s ease-out;
        }
        .confirm-icon {
          width: 42px; height: 42px; flex: none; border-radius: 50%;
          background: var(--danger-soft); color: var(--danger);
          display: flex; align-items: center; justify-content: center;
        }
        .warn-note {
          background: var(--amber-soft); border: 1px solid #E8CD8A; color: #6B4300;
          border-radius: 10px; padding: 0.85rem 1rem; font-size: 0.9rem; line-height: 1.5;
        }
        @keyframes modalAppear {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .custom-modal { animation: none; }
        }
      `}</style>

      <Header
        EmployeeName={employeeInfo ? `${employeeInfo.firstName} ${employeeInfo.lastName}` : ''}
        EmployeeRole={employeeInfo ? employeeInfo.role : ''}
        EmployeeRoleLabel={employeeInfo ? employeeInfo.roleLabel : ''}
      />

      <main className="container py-4">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
          <div className="d-flex flex-wrap align-items-baseline gap-2 gap-md-3">
            <h1 className="page-title mb-0">
              Bonjour{employeeInfo ? `, ${employeeInfo.firstName}` : ''}
            </h1>
            <span className="hero-label">Espace employé</span>
          </div>
          <button
            className="btn btn-brand px-4"
            onClick={() => setShowRequestModal(true)}
          >
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
            <section
              className="section-card mb-4 last-request-card"
              style={{ '--status-color': lastRequest ? (STATUS_STYLES[lastRequest.status]?.fg ?? 'var(--border)') : 'var(--border)' }}
            >
              <p className="last-request-label mb-2">Dernière demande</p>
              {!lastRequest ? (
                <p className="empty-state mb-0">Aucune demande de congé pour le moment.</p>
              ) : (
                <>
                  <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
                    <h2 className="section-title mb-0">{LEAVE_TYPE_LABELS[lastRequest.leaveType] ?? lastRequest.leaveType}</h2>
                    <StatusBadge status={lastRequest.status} />
                  </div>

                  <div className="row g-3 mb-3">
                    <div className="col-12 col-sm-6 col-md-4">
                      <p className="hero-label mb-1">Dates</p>
                      <p className="fw-medium mb-0">
                        {formatDate(lastRequest.startDate)}
                        {lastRequestEndDate ? ` → ${formatDate(lastRequestEndDate)}` : ''}
                      </p>
                    </div>
                    <div className="col-12 col-sm-6 col-md-4">
                      <p className="hero-label mb-1">Durée</p>
                      <p className="fw-medium mb-0">{lastRequest.duration} j</p>
                    </div>
                    {lastRequest.status === 'pending' && lastRequestStepLabel && (
                      <div className="col-12 col-md-4">
                        <p className="hero-label mb-1">Étape actuelle</p>
                        <p className="fw-medium mb-0">{lastRequestStepLabel}</p>
                      </div>
                    )}
                  </div>

                  {lastRequest.status === 'rejected' && (
                    <div className="reject-note mb-3">
                      {lastRequest.rejectedByName && (
                        <div><strong>Refusée par :</strong> {lastRequest.rejectedByName}</div>
                      )}
                      <strong>Motif du refus :</strong> {lastRequest.rejectionReason || 'Aucune raison détaillée.'}
                    </div>
                  )}

                  {['annual', 'advance'].includes(lastRequest.leaveType) && lastRequest.allocations?.length > 0 && (
                    <div className="mb-3">
                      <p className="hero-label mb-2">Répartition</p>
                      <div className="split-list">
                        {lastRequest.allocations.map((a, i) => (
                          <div key={i} className="mb-1">Exercice {a.year} : {a.daysAllocated} j</div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    className="btn btn-sm cancel-btn"
                    disabled={cancelingId === lastRequest.id || lastRequest.status === 'cancelled' || lastRequest.status === 'rejected'}
                    onClick={() => promptCancel(lastRequest)}
                  >
                    {cancelingId === lastRequest.id ? 'Annulation...' : 'Annuler cette demande'}
                  </button>
                </>
              )}
            </section>

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
                            <span className="exercise-unit">jours</span>
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="section-card">
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
                <h2 className="section-title mb-0">Historique des demandes</h2>
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
                        <th className="fw-medium">Type</th>
                        <th className="fw-medium">Dates</th>
                        <th className="fw-medium">Durée</th>
                        <th className="fw-medium">Statut</th>
                        <th className="fw-medium">Actions</th>
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
                              <td className="fw-medium">{LEAVE_TYPE_LABELS[lr.leaveType] ?? lr.leaveType}</td>
                              <td>
                                {formatDate(lr.startDate)}
                                {endDate ? ` → ${formatDate(endDate)}` : ''}
                              </td>
                              <td>{lr.duration} j</td>
                              <td><StatusBadge status={lr.status} /></td>
                              <td>
                                <div className="d-flex flex-wrap gap-2">
                                  {hasDetails && (
                                    <button
                                      className="btn btn-sm info-btn"
                                      onClick={() => toggleDetails(lr.id)}
                                    >
                                      {isExpanded ? 'Masquer' : 'Plus d\'infos'}
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