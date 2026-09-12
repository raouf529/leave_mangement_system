import { useState, useEffect } from 'react';
import axios from 'axios';
import Header from './header';

function getMySteps() {
  return axios.get('http://localhost:5000/api/request/steps/me', { withCredentials: true });
}

function decideStep(stepId, decision, comment) {
  return axios.patch(
    `http://localhost:5000/api/request/step/${stepId}`,
    { decision, comment },
    { withCredentials: true }
  );
}

const LEAVE_TYPE_LABELS = {
  annual: 'Congé annuel',
  exceptional: 'Congé exceptionnel',
  advance: 'Avance sur congé'
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

function ApprovalInbox() {
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actioningStepId, setActioningStepId] = useState(null);
  const [rejectComment, setRejectComment] = useState({});

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
    fetchSteps();
  }, []);

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
    <div
      className="min-vh-100"
      style={{ background: 'linear-gradient(135deg, #eef2fb 0%, #f7f9fc 100%)' }}
    >
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

        <div className="bg-white shadow rounded-4 p-4 p-md-5">
          {loading ? (
            <div className="text-center text-muted py-5">Chargement...</div>
          ) : steps.length === 0 ? (
            <p className="text-muted mb-0">Aucune demande en attente.</p>
          ) : (
            <div className="d-flex flex-column gap-3">
              {steps.map((step) => {
                const endDate = getEndDate(step.start_date, step.duration);
                const isActioning = actioningStepId === step.step_id;
                return (
                  <div key={step.step_id} className="border rounded-4 p-3 p-md-4">
                    <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
                      <p className="fw-bold mb-0">{step.First_name} {step.Last_name}</p>
                      <span className="badge rounded-pill bg-light text-dark border">
                        {LEAVE_TYPE_LABELS[step.leave_type] ?? step.leave_type}
                      </span>
                    </div>
                    <p className="text-muted small mb-2">{step.email}</p>
                    <p className="mb-1">
                      {formatDate(step.start_date)}{endDate ? ` → ${formatDate(endDate)}` : ''}
                      {' · '}{step.duration} j
                    </p>
                    {step.justification && (
                      <p className="text-muted small mb-3">Justification : {step.justification}</p>
                    )}

                    <div className="d-flex flex-wrap align-items-center gap-2 mt-3">
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="Commentaire (requis pour refuser)"
                        style={{ maxWidth: '280px' }}
                        value={rejectComment[step.step_id] ?? ''}
                        onChange={(e) =>
                          setRejectComment((prev) => ({ ...prev, [step.step_id]: e.target.value }))
                        }
                      />
                      <button
                        className="btn btn-success btn-sm"
                        onClick={() => handleApprove(step.step_id)}
                        disabled={isActioning}
                      >
                        Approuver
                      </button>
                      <button
                        className="btn btn-outline-danger btn-sm"
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