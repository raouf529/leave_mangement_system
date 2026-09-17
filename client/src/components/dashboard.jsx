import { useState, useEffect, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import api from './api';
import Header from './header';
import LeaveRequestModal from './LeaveRequestModal';
// this page where employee information and can send leave request and see the status of leave request

async function getInformation() {
  const response = await api.get('/profile/me');
  return response.data;
}

async function getMyPendingSteps() {
  const response = await api.get('/request/steps/me');
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
  const navigate = useNavigate();

  function toggleDetails(requestId) {
    setExpandedId((prev) => (prev === requestId ? null : requestId));
  }

  async function handleCancelRequest(requestId) {
    setCancelingId(requestId);
    try {
      await cancelRequest(requestId);
      setEmployeeInfo((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          leaveRequests: prev.leaveRequests.map((request) =>
            request.id === requestId ? { ...request, status: 'cancelled' } : request
          )
        };
      });
      setError('');
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
  }, []);

  const activeExercises = (employeeInfo?.exercises ?? []).filter(
    (ex) => Number(ex.balance) > 0
  );
  const leaveRequests = employeeInfo?.leaveRequests ?? [];
  const annualSplitRequests = leaveRequests.filter(
    (lr) => lr.leaveType === 'annual' && (lr.status === 'pending' || lr.status === 'approved')
  );
  const totalBalance = activeExercises.reduce((sum, ex) => sum + Number(ex.balance || 0), 0);

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
        .hero-number { font-size: 2.5rem; font-weight: 700; line-height: 1; color: var(--primary); }
        .section-card { background: var(--surface); border-radius: 14px; border: 1px solid var(--border); }
        .section-title { font-size: 1.25rem; font-weight: 600; color: var(--ink); }
        .exercise-card { border-left: 3px solid #D8DEE5; background: #FAFBFC; border-radius: 10px; padding: 1.1rem 1.25rem; }
        .exercise-card p { font-size: 1rem; }
        .exercise-balance { font-size: 1.85rem; font-weight: 700; }
        .split-list { font-size: 0.95rem; }
        .status-badge { display: inline-flex; align-items: center; gap: 6px; padding: 0.35rem 0.75rem; border-radius: 999px; font-size: 0.88rem; font-weight: 600; }
        .status-dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; }
        .muted-note { font-size: 0.92rem; color: var(--muted); }
        .cancel-btn { border: 1px solid var(--border); color: var(--ink); background: #fff; font-size: 0.9rem; }
        .history-table { font-size: 0.98rem; }
        .history-table thead th { font-size: 0.85rem; color: var(--muted); text-transform: none; padding-bottom: 0.75rem; }
        .history-table td { padding-top: 1rem; padding-bottom: 1rem; }
        .info-btn { border: 1px solid var(--border); background: #fff; color: var(--primary); font-size: 0.88rem; }
        .detail-row td { background: var(--canvas); border-top: none; padding-top: 0.9rem; padding-bottom: 1.1rem; font-size: 0.92rem; }
        .detail-row .detail-line { margin-bottom: 0.35rem; }
        .detail-row .detail-line:last-child { margin-bottom: 0; }
      `}</style>

      <Header
        EmployeeName={employeeInfo ? `${employeeInfo.firstName} ${employeeInfo.lastName}` : ''}
        EmployeeRole={employeeInfo ? employeeInfo.role : ''}
        EmployeeRoleLabel={employeeInfo ? employeeInfo.roleLabel : ''}
      />

      <div className="hero-strip py-4 py-md-5">
        <div className="container d-flex flex-wrap align-items-end justify-content-between gap-3">
          <div>
            <p className="hero-label mb-1">Espace employé</p>
            <h1 className="h3 fw-bold mb-0">
              Bonjour{employeeInfo ? `, ${employeeInfo.firstName}` : ''}
            </h1>
          </div>
          <div className="d-flex align-items-end gap-4">
            <button
              className="btn btn-lg"
              style={{ background: 'var(--primary)', color: '#fff' }}
              onClick={() => setShowRequestModal(true)}
            >
              Demander un congé
            </button>
          </div>
        </div>
      </div>

      <main className="container py-4 py-md-5">
        {error && (
          <div className="alert alert-danger py-2 small" role="alert">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-5" style={{ color: 'var(--muted)' }}>Chargement...</div>
        ) : (
          <>
            <section className="section-card p-4 p-md-5 mb-4">
              <h2 className="section-title mb-4">Exercices</h2>
              {activeExercises.length === 0 ? (
                <p className="muted-note mb-0">Aucun solde disponible pour le moment.</p>
              ) : (
                <div className="row g-3">
                  {activeExercises.map((exercise, index) => {
                    const range = getExerciseRange(exercise.exercise);
                    const current = isCurrentExercise(exercise.exercise);
                    return (
                      <div className="col-12 col-sm-6 col-md-4" key={index}>
                        <div className="exercise-card h-100">
                          <p className="fw-semibold mb-1">
                            {range ? `Exercice ${range.startYear} / ${range.endYear}` : exercise.exercise}
                          </p>
                          {range && <p className="muted-note mb-3">Du {range.from} au {range.to}</p>}
                          <p className="exercise-balance mb-1" style={{ color: 'var(--primary)' }}>
                            {exercise.balance}{' '}
                            <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--muted)' }}>jours</span>
                          </p>
                          {current && <p className="muted-note mb-0">Exercice en cours</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="section-card p-4 p-md-5 mb-4">
              <h2 className="section-title mb-4">Répartition du congé annuel</h2>
              {annualSplitRequests.length === 0 ? (
                <p className="muted-note mb-0">
                  Aucune demande annuelle active pour afficher une répartition.
                </p>
              ) : (
                <div className="row g-3">
                  {annualSplitRequests.map((request) => {
                    const allocations = request.allocations ?? [];
                    return (
                      <div key={request.id} className="col-12 col-lg-6">
                        <div className="exercise-card h-100">
                          <div className="d-flex justify-content-between align-items-center mb-2">
                            <strong>Demande du {formatDate(request.startDate)}</strong>
                            <span className="muted-note">{request.duration} j</span>
                          </div>
                          {allocations.length > 0 ? (
                            <div className="split-list">
                              {allocations.map((a, i) => (
                                <div key={i} className="mb-1">
                                  Exercice {a.year} : {a.daysAllocated} j
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="muted-note mb-0">Aucune allocation enregistrée.</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="section-card p-4 p-md-5">
              <h2 className="section-title mb-4">Historique des demandes</h2>
              {leaveRequests.length === 0 ? (
                <p className="muted-note mb-0">Aucune demande de congé pour le moment.</p>
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
                      {leaveRequests.map((lr) => {
                        const endDate = getEndDate(lr.startDate, lr.duration);
                        const currentStepLabel = lr.currentStep
                          ? lr.currentStep.kind === 'hr'
                            ? 'HR'
                            : lr.currentStep.kind === 'unit'
                              ? `${lr.currentStep.unitName ?? 'Unité'} (${lr.currentStep.unitType ?? 'unit'})`
                              : lr.currentStep.targetName
                          : null;
                        const rejectionNote = lr.status === 'rejected' ? (lr.rejectionReason || 'Aucune raison détaillée.') : null;
                        const annualSplit = lr.leaveType === 'annual' && lr.allocations?.length
                          ? lr.allocations.map((allocation) => `Exercice ${allocation.year} : ${allocation.daysAllocated} j`).join(' · ')
                          : null;
                        const hasDetails = Boolean(annualSplit || (lr.status === 'pending' && currentStepLabel) || rejectionNote);
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
                                <div className="d-flex gap-2">
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
                                    disabled={cancelingId === lr.id || lr.status === 'cancelled' || lr.status === 'rejected' || lr.status === 'approved'}
                                    onClick={() => handleCancelRequest(lr.id)}
                                  >
                                    {cancelingId === lr.id ? 'Annulation...' : 'Annuler'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr className="detail-row">
                                <td colSpan={5}>
                                  {annualSplit && <div className="detail-line">Répartition : {annualSplit}</div>}
                                  {lr.status === 'pending' && currentStepLabel && (
                                    <div className="detail-line">Étape : {currentStepLabel}</div>
                                  )}
                                  {rejectionNote && (
                                    <div className="detail-line" style={{ color: 'var(--danger)' }}>Motif : {rejectionNote}</div>
                                  )}
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

      {showRequestModal && (
        <LeaveRequestModal
          onClose={() => setShowRequestModal(false)}
          onSuccess={() => window.location.reload()} // simplest refresh; swap for a refetch call later
        />
      )}
    </div>
    
  );
}

export default Dashboard;