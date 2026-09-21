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

const REASON_LABELS = {
  medical: 'Médical',
  family_event: 'Événement familial',
  other: 'Autre'
};

const ROLE_LABELS = {
  employe: 'Employé',
  chef_service: 'Chef de service',
  chef_departement: 'Chef de département',
  directeur: 'Directeur',
  drh: 'DRH'
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

// The duration counts the first and the last day, so the last day is start + duration - 1
function getEndDate(startDate, duration) {
  if (!startDate) return null;
  const d = new Date(startDate);
  d.setDate(d.getDate() + Math.max((Number(duration) || 0) - 1, 0));
  return d;
}

// Everything the table and the decision box need to display about one step
function describeStep(step, currentUserId) {
  const fullName = `${step.prenom ?? ''} ${step.nom ?? ''}`.trim();
  const creatorName = `${step.creator_first_name ?? ''} ${step.creator_last_name ?? ''}`.trim();
  return {
    fullName,
    endDate: getEndDate(step.start_date, step.duration),
    isDirectTarget: Number(step.target_id) === Number(currentUserId),
    targetName: `${step.target_prenom ?? ''} ${step.target_nom ?? ''}`.trim(),
    targetRole: ROLE_LABELS[step.target_role] ?? step.target_role ?? 'Responsable',
    creatorName,
    creatorRole: step.creator_role ? (ROLE_LABELS[step.creator_role] ?? step.creator_role) : '',
    createdForSomeoneElse: Boolean(creatorName) && creatorName !== fullName
  };
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
  // Decision box: which step is open, what the supervisor chose and wrote
  const [selectedStep, setSelectedStep] = useState(null);
  const [decision, setDecision] = useState('');
  const [comment, setComment] = useState('');
  const [commentError, setCommentError] = useState('');
  const [modalError, setModalError] = useState('');
  const { user: currentUser, role: currentRole, loading: currentUserLoading } = useCurrentUser();

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

  // Escape closes the decision box (unless a decision is being sent)
  useEffect(() => {
    if (!selectedStep) return undefined;
    function handleKeyDown(e) {
      if (e.key === 'Escape' && !actioningStepId) setSelectedStep(null);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedStep, actioningStepId]);

  function openDecision(step) {
    setSelectedStep(step);
    setDecision('');
    setComment('');
    setCommentError('');
    setModalError('');
  }

  function closeDecision() {
    if (actioningStepId) return;
    setSelectedStep(null);
  }

  function chooseDecision(value) {
    setDecision(value);
    setCommentError('');
    setModalError('');
  }

  async function handleConfirm() {
    if (!selectedStep || !decision) return;

    const trimmedComment = comment.trim();
    if (decision === 'rejected' && !trimmedComment) {
      setCommentError('Expliquez le motif du refus : il est obligatoire pour refuser une demande.');
      document.getElementById('decision-comment')?.focus();
      return;
    }

    setActioningStepId(selectedStep.step_id);
    setModalError('');
    try {
      await decideStep(selectedStep.step_id, decision, trimmedComment);
      setSelectedStep(null);
      await fetchSteps();
    } catch (err) {
      setModalError(
        err.response?.data?.error
          ?? (decision === 'approved' ? "Impossible d'approuver cette demande." : 'Impossible de refuser cette demande.')
      );
    } finally {
      setActioningStepId(null);
    }
  }

  const selectedInfo = selectedStep ? describeStep(selectedStep, currentUser?.id) : null;
  const isActioning = Boolean(selectedStep) && actioningStepId === selectedStep.step_id;

  return (
    <div className="leave-dashboard">
      <style>{`
        .leave-dashboard {
          --ink: #050505;
          --muted: #55708f;
          --surface: #FFFFFF;
          --canvas: #F8FAFC;
          --border: #DCE5EF;
          --primary: #0867D8;
          --accent-amber: #AF5B00;
          --amber-soft: #FFF2C7;
          --success: #008B68;
          --success-soft: #C8F7E5;
          --danger: #C1544A;
          --danger-soft: #FBEAE8;
          --neutral-soft: #EEF1F4;
          min-height: 100vh;
          background: var(--canvas);
          color: var(--ink);
        }
        .section-card { background: var(--surface); border-radius: 20px; border: 1px solid var(--border); box-shadow: 0 2px 4px rgba(27, 36, 48, 0.12); }
        .status-badge { display: inline-flex; align-items: center; gap: 6px; padding: 0.3rem 0.65rem; border-radius: 999px; font-size: 0.8rem; font-weight: 600; white-space: nowrap; }
        .status-dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; }
        .muted-note { font-size: 0.82rem; color: var(--muted); }
        .primary-button { background: var(--primary); color: #fff; }
        .primary-button:hover { background: #0755B5; color: #fff; }

        .inbox-table-wrap { border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
        .inbox-table { font-size: 0.95rem; }
        .inbox-table thead th { font-size: 0.8rem; color: var(--muted); text-transform: uppercase; padding: 1rem 1.1rem; background: #F5F8FB; white-space: nowrap; }
        .inbox-table td { padding: 1rem 1.1rem; }
        .mini-badge { display: inline-block; margin-top: 4px; padding: 0.12rem 0.55rem; border-radius: 999px; font-size: 0.75rem; font-weight: 600; }

        .decision-backdrop {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 1050; padding: 24px;
          background: rgba(15, 23, 42, 0.45); backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center;
        }
        .decision-modal {
          background: #fff; border-radius: 16px; width: 100%; max-width: 560px; max-height: 92vh;
          display: flex; flex-direction: column; overflow: hidden;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
          animation: decisionAppear 0.2s ease-out;
        }
        @keyframes decisionAppear {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
        .decision-header { padding: 1.4rem 1.6rem 1rem; flex: none; }
        .decision-body { padding: 0 1.6rem 1rem; overflow-y: auto; flex: 1 1 auto; }
        .decision-footer { padding: 0.5rem 1.6rem 1.4rem; flex: none; }
        .close-btn { width: 36px; height: 36px; border: none; background: transparent; color: var(--muted); border-radius: 10px; flex: none; }
        .close-btn:hover { background: var(--neutral-soft); }
        .close-btn:focus-visible, .choice-btn:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
        .decision-info { background: #F5F8FB; border-radius: 12px; padding: 1rem 1.15rem; margin-bottom: 0.85rem; }
        .decision-row { margin: 0 0 0.25rem; line-height: 1.5; overflow-wrap: anywhere; }
        .decision-row:last-child { margin-bottom: 0; }
        .decision-label { color: var(--muted); }
        .step-box { border-radius: 12px; padding: 0.85rem 1.15rem; margin-bottom: 1.1rem; }
        .split-badge { display: inline-block; padding: 0.2rem 0.65rem; border-radius: 999px; background: #fff; border: 1px solid var(--border); color: var(--primary); font-size: 0.8rem; font-weight: 600; }
        .decision-choice { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 1.25rem; }
        .choice-btn { min-height: 52px; border: 1px solid var(--border); background: #fff; color: var(--ink); border-radius: 12px; font-weight: 600; transition: background 150ms ease, border-color 150ms ease, color 150ms ease; }
        .choice-btn:hover:not(:disabled) { background: #F5F8FB; }
        .choice-btn.approve.selected { background: var(--success-soft); border-color: var(--success); color: var(--success); }
        .choice-btn.reject.selected { background: var(--danger-soft); border-color: var(--danger); color: var(--danger); }
        .required-mark { color: #B3261E; }
        .has-error { border-color: #B3261E; }
        .has-error:focus { border-color: #B3261E; box-shadow: 0 0 0 0.25rem rgba(179, 38, 30, 0.15); }
        .field-error { display: flex; align-items: flex-start; gap: 6px; margin-top: 6px; color: #B3261E; font-size: 0.85rem; line-height: 1.35; }
        .field-error svg { flex: none; margin-top: 2px; }
        .cancel-btn { border: 1px solid var(--border); background: #fff; color: var(--ink); }
        .confirm-btn { color: #fff; border: none; }
        .confirm-btn:disabled { opacity: 0.45; }
        @media (max-width: 575.98px) {
          .decision-backdrop { padding: 12px; }
          .decision-header { padding: 1.1rem 1.1rem 0.8rem; }
          .decision-body { padding: 0 1.1rem 0.8rem; }
          .decision-footer { padding: 0.5rem 1.1rem 1.1rem; }
        }
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
            <div className="inbox-table-wrap">
              <div className="table-responsive">
                <table className="inbox-table table align-middle mb-0">
                  <thead>
                    <tr>
                      <th className="fw-medium">Matricule</th>
                      <th className="fw-medium">Employé</th>
                      <th className="fw-medium">Type</th>
                      <th className="fw-medium">Dates</th>
                      <th className="fw-medium">Durée</th>
                      <th className="fw-medium">Étape</th>
                      <th className="fw-medium">Statut</th>
                      <th className="fw-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {steps.map((step) => {
                      const info = describeStep(step, currentUser?.id);
                      return (
                        <tr key={step.step_id}>
                          <td className="fw-medium text-nowrap">{step.matricule ?? '—'}</td>
                          <td>
                            <div className="fw-semibold">{info.fullName}</div>
                            {info.createdForSomeoneElse && (
                              <div className="muted-note">
                                Créée par {info.creatorName}{info.creatorRole ? ` (${info.creatorRole})` : ''}
                              </div>
                            )}
                          </td>
                          <td>{LEAVE_TYPE_LABELS[step.leave_type] ?? step.leave_type}</td>
                          <td className="text-nowrap">
                            {formatDate(step.start_date)}{info.endDate ? ` → ${formatDate(info.endDate)}` : ''}
                          </td>
                          <td className="text-nowrap">{step.duration} j</td>
                          <td>
                            <div className="fw-medium">{info.targetRole}</div>
                            {info.targetName && <div className="muted-note">{info.targetName}</div>}
                            <span
                              className="mini-badge"
                              style={info.isDirectTarget
                                ? { background: 'var(--amber-soft)', color: 'var(--accent-amber)' }
                                : { background: 'var(--neutral-soft)', color: 'var(--muted)' }}
                            >
                              {info.isDirectTarget ? 'Assignée à vous' : 'Supérieur hiérarchique'}
                            </span>
                          </td>
                          <td><StatusBadge status={step.request_status ?? 'pending'} /></td>
                          <td>
                            <button className="btn btn-sm primary-button px-3" onClick={() => openDecision(step)}>
                              Traiter
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      {selectedStep && (
        <div className="decision-backdrop" onClick={closeDecision}>
          <div
            className="decision-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="decision-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="decision-header d-flex align-items-start justify-content-between gap-3">
              <h2 id="decision-title" className="h5 fw-bold mb-0 pt-1">Décision — {selectedInfo.fullName}</h2>
              <button type="button" className="close-btn" onClick={closeDecision} aria-label="Fermer" disabled={isActioning}>
                ✕
              </button>
            </div>

            <div className="decision-body">
              <div className="decision-info">
                <p className="decision-row"><span className="decision-label">Matricule :</span> {selectedStep.matricule ?? '—'}</p>
                {selectedStep.email && (
                  <p className="decision-row"><span className="decision-label">Email :</span> {selectedStep.email}</p>
                )}
                <p className="decision-row">
                  <span className="decision-label">Type :</span> {LEAVE_TYPE_LABELS[selectedStep.leave_type] ?? selectedStep.leave_type}
                </p>
                <p className="decision-row">
                  <span className="decision-label">Dates :</span> {formatDate(selectedStep.start_date)}
                  {selectedInfo.endDate ? ` → ${formatDate(selectedInfo.endDate)}` : ''} ({selectedStep.duration} j)
                </p>
                {selectedStep.reason_type && (
                  <p className="decision-row">
                    <span className="decision-label">Motif :</span> {REASON_LABELS[selectedStep.reason_type] ?? selectedStep.reason_type}
                  </p>
                )}
                {selectedStep.justification && (
                  <p className="decision-row"><span className="decision-label">Justification :</span> {selectedStep.justification}</p>
                )}
                {selectedStep.url_justification && (
                  <p className="decision-row">
                    <span className="decision-label">Pièce justificative :</span>{' '}
                    <a
                      href={`${api.defaults.baseURL}/request/${selectedStep.request_id}/document`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Ouvrir le document
                    </a>
                  </p>
                )}
                {selectedStep.leave_type === 'annual' && selectedStep.annualSplit && selectedStep.annualSplit.length > 0 && (
                  <div className="decision-row">
                    <span className="decision-label d-block mb-1">Répartition annuelle :</span>
                    <div className="d-flex flex-wrap gap-2">
                      {selectedStep.annualSplit.map((allocation, index) => (
                        <span key={`${selectedStep.request_id}-${index}`} className="split-badge">
                          Exercice {allocation.year} : {allocation.daysAllocated} j
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {selectedInfo.creatorName && (
                  <p className="decision-row">
                    <span className="decision-label">Créée par :</span> {selectedInfo.creatorName}
                    {selectedInfo.creatorRole ? ` (${selectedInfo.creatorRole})` : ''}
                  </p>
                )}
              </div>

              <div
                className="step-box"
                style={{ background: selectedInfo.isDirectTarget ? 'var(--amber-soft)' : 'var(--neutral-soft)' }}
              >
                <strong>Étape actuelle :</strong> {selectedInfo.targetRole}{selectedInfo.targetName ? ` — ${selectedInfo.targetName}` : ''}
                <span className="muted-note d-block">
                  {selectedInfo.isDirectTarget
                    ? 'Cette demande vous est directement assignée.'
                    : 'Vous pouvez intervenir sur cette étape en tant que supérieur hiérarchique.'}
                </span>
              </div>

              <div className="decision-choice">
                <button
                  type="button"
                  className={`choice-btn approve ${decision === 'approved' ? 'selected' : ''}`}
                  aria-pressed={decision === 'approved'}
                  onClick={() => chooseDecision('approved')}
                  disabled={isActioning}
                >
                  Approuver
                </button>
                <button
                  type="button"
                  className={`choice-btn reject ${decision === 'rejected' ? 'selected' : ''}`}
                  aria-pressed={decision === 'rejected'}
                  onClick={() => chooseDecision('rejected')}
                  disabled={isActioning}
                >
                  Rejeter
                </button>
              </div>

              <label className="form-label fw-medium" htmlFor="decision-comment">
                {decision === 'rejected'
                  ? <>Motif du refus <span className="required-mark">*</span></>
                  : 'Justification (facultatif)'}
              </label>
              <textarea
                id="decision-comment"
                className={`form-control ${commentError ? 'has-error' : ''}`}
                rows={4}
                value={comment}
                onChange={(e) => { setComment(e.target.value); setCommentError(''); }}
                placeholder={decision === 'rejected' ? 'Expliquez pourquoi la demande est refusée...' : 'Ajoutez un commentaire (facultatif)...'}
                aria-invalid={Boolean(commentError)}
                aria-describedby={commentError ? 'decision-comment-error' : undefined}
                disabled={isActioning}
              />
              {commentError ? (
                <div id="decision-comment-error" className="field-error" role="alert">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>{commentError}</span>
                </div>
              ) : decision === 'rejected' ? (
                <div className="form-text">L'employé verra ce motif.</div>
              ) : null}
            </div>

            <div className="decision-footer">
              {modalError && (
                <div className="alert alert-danger py-2 small mb-3 d-flex align-items-start gap-2" role="alert">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none', marginTop: 1 }}>
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <div>
                    <strong className="d-block">La décision n'a pas pu être enregistrée</strong>
                    {modalError}
                  </div>
                </div>
              )}
              <div className="d-flex justify-content-end gap-2">
                <button type="button" className="btn cancel-btn px-3" onClick={closeDecision} disabled={isActioning}>
                  Fermer
                </button>
                <button
                  type="button"
                  className="btn confirm-btn px-4"
                  style={{ background: decision === 'rejected' ? 'var(--danger)' : 'var(--success)' }}
                  onClick={handleConfirm}
                  disabled={!decision || isActioning}
                >
                  {isActioning ? 'Envoi...' : 'Confirmer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ApprovalInbox;