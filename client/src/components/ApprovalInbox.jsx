import { useState, useEffect } from 'react';
import api from './api';
import Header from './header';
import useCurrentUser from '../hooks/useCurrentUser';

function getMySteps() {
  return api.get('/request/steps/me');
}

function decideStep(stepId, decision, comment) {
  return api.patch(`/request/step/${stepId}`, { decision, comment });
}

const LEAVE_TYPE_LABELS = {
  annual: 'Congé annuel',
  exceptional: 'Congé exceptionnel',
  advance: 'Avance sur congé'
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
      {status === 'pending' ? 'En attente' : status === 'approved' ? 'Approuvée' : status === 'rejected' ? 'Refusée' : status === 'cancelled' ? 'Annulée' : status}
    </span>
  );
}

function ApprovalInbox() {
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actioningStepId, setActioningStepId] = useState(null);
  const [rejectComment, setRejectComment] = useState({});
  const { role: currentRole, loading: currentUserLoading } = useCurrentUser();

  async function fetchSteps() {
    setLoading(true);
    try {
      const response = await getMySteps();
      setSteps(response.data ?? []);
    } catch (err) {
      console.error('Error fetching pending steps:', err);
      setError('Impossible de charger les demandes en attente.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (currentUserLoading) {
      return;
    }

    if (currentRole === 'head' || currentRole === 'hr') {
      fetchSteps();
      return;
    }

    setSteps([]);
    setLoading(false);
    setError('Accès réservé aux responsables.');
  }, [currentRole, currentUserLoading]);

  async function handleApprove(stepId) {
    setActioningStepId(stepId);
    try {
      await decideStep(stepId, 'approved', '');
      await fetchSteps();
    } catch (err) {
      setError(err.response?.data?.error ?? "Impossible d'approuver cette demande.");
    } finally {
      setActioningStepId(null);
    }
  }

  async function handleReject(stepId) {
    const comment = (rejectComment[stepId] ?? '').trim();
    if (!comment) {
      setError('Un commentaire est requis pour refuser une demande.');
      return;
    }
    setActioningStepId(stepId);
    try {
      await decideStep(stepId, 'rejected', comment);
      await fetchSteps();
    } catch (err) {
      setError(err.response?.data?.error ?? 'Impossible de refuser cette demande.');
    } finally {
      setActioningStepId(null);
    }
  }

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
        .section-card { background: var(--surface); border-radius: 14px; border: 1px solid var(--border); }
        .section-title { font-size: 1.05rem; font-weight: 600; color: var(--ink); }
        .request-card { border: 1px solid var(--border); border-radius: 14px; background: #fff; padding: 1.1rem 1.2rem; }
        .status-badge { display: inline-flex; align-items: center; gap: 6px; padding: 0.3rem 0.65rem; border-radius: 999px; font-size: 0.8rem; font-weight: 600; }
        .status-dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; }
        .muted-note { font-size: 0.82rem; color: var(--muted); }
        .primary-button { background: var(--primary); color: #fff; }
        .outline-danger-button { border: 1px solid var(--danger); color: var(--danger); background: #fff; }
      `}</style>

      <Header />

      <main className="container py-4 py-md-5">
        <div className="mb-4">
          <h1 className="h3 fw-bold mb-1">Demandes à traiter</h1>
          <p className="text-muted mb-0">Congés en attente de votre décision</p>
        </div>

        {error && (
          <div className="alert alert-danger py-2 small" role="alert">
            {error}
          </div>
        )}

        <div className="section-card p-4 p-md-5">
          {loading ? (
            <div className="text-center py-5 muted-note">Chargement...</div>
          ) : steps.length === 0 ? (
            <p className="muted-note mb-0">Aucune demande en attente.</p>
          ) : (
            <div className="d-flex flex-column gap-3">
              {steps.map((step) => {
                const endDate = getEndDate(step.start_date, step.duration);
                const isActioning = actioningStepId === step.step_id;
                return (
                  <div key={step.step_id} className="request-card">
                    <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
                      <p className="fw-bold mb-0">{step.First_name} {step.Last_name}</p>
                      <StatusBadge status={step.request_status ?? 'pending'} />
                    </div>

                    <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
                      <span className="badge rounded-pill border" style={{ background: 'var(--neutral-soft)', color: 'var(--primary)' }}>
                        {LEAVE_TYPE_LABELS[step.leave_type] ?? step.leave_type}
                      </span>
                      <span className="muted-note">{step.email}</span>
                    </div>

                    <p className="mb-1">
                      {formatDate(step.start_date)}{endDate ? ` → ${formatDate(endDate)}` : ''}
                      {' · '}{step.duration} j
                    </p>
                    {step.justification && (
                      <p className="muted-note mb-3">Justification : {step.justification}</p>
                    )}
                    {step.url_justification && (
                      <p className="mb-3">
                        <a
                          href={`${api.defaults.baseURL}/request/${step.request_id}/document`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-sm btn-outline-secondary"
                        >
                          Ouvrir le document justificatif
                        </a>
                      </p>
                    )}

                    {step.leave_type === 'annual' && step.annualSplit && step.annualSplit.length > 0 && (
                      <div className="mb-3">
                        <p className="small fw-medium text-muted mb-2">Répartition annuelle :</p>
                        <div className="d-flex flex-wrap gap-2">
                          {step.annualSplit.map((allocation, index) => (
                            <span key={`${step.request_id}-${index}`} className="badge rounded-pill border px-3 py-2" style={{ background: 'var(--neutral-soft)', color: 'var(--primary)' }}>
                              Exercice {allocation.year} : {allocation.daysAllocated} j
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="d-flex flex-wrap align-items-center gap-2 mt-3">
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="Commentaire (requis pour refuser)"
                        style={{ maxWidth: '280px' }}
                        value={rejectComment[step.step_id] ?? ''}
                        onChange={(e) => setRejectComment((prev) => ({ ...prev, [step.step_id]: e.target.value }))}
                      />
                      <button
                        className="btn btn-sm primary-button"
                        onClick={() => handleApprove(step.step_id)}
                        disabled={isActioning}
                      >
                        Approuver
                      </button>
                      <button
                        className="btn btn-sm outline-danger-button"
                        onClick={() => handleReject(step.step_id)}
                        disabled={isActioning}
                      >
                        Refuser
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default ApprovalInbox;