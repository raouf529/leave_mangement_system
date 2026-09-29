import { useState, useEffect } from 'react';
import api from './api';
import Header from './header';
import useCurrentUser from '../hooks/useCurrentUser';
import './theme.css';
import './ApprovalInbox.css';

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

function getInitials(fullName) {
  const parts = (fullName || '').split(' ').filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
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
      <Header pendingInboxCount={steps.length} />

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

        <div className="section-card overflow-hidden">
          {loading ? (
            <div className="text-center p-5 muted-note">Chargement...</div>
          ) : steps.length === 0 ? (
            <p className="muted-note mb-0 p-4">Aucune demande en attente.</p>
          ) : (
            <div className="table-responsive">
              <table className="inbox-table table align-middle mb-0">
                <thead>
                  <tr>
                    <th className="fw-medium">Employé</th>
                    <th className="fw-medium">Congé</th>
                    <th className="fw-medium">Étape</th>
                    <th className="fw-medium text-end">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {steps.map((step) => {
                    const info = describeStep(step, currentUser?.id);
                    return (
                      <tr key={step.step_id}>
                        <td>
                          <div className="d-flex align-items-center gap-3">
                            <span className="emp-avatar" aria-hidden="true">{getInitials(info.fullName)}</span>
                            <div>
                              <div className="fw-semibold">{info.fullName}</div>
                              <div className="cell-sub">{step.fonction || 'Fonction non renseignée'}</div>
                              <div className="cell-sub d-flex flex-wrap align-items-center gap-1 inbox-employee-meta">
                                {step.matricule && <span>Matricule {step.matricule}</span>}
                                {info.createdForSomeoneElse && (
                                  <span className="badge rounded-pill bg-light text-secondary border fw-normal">
                                    Créée par {info.creatorRole || 'un responsable'}
                                  </span>
                                )}
                                {(step.created_at || step.createdAt || step.submission_date) && (
                                  <span>Soumise le {formatDate(step.created_at || step.createdAt || step.submission_date)}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="fw-medium">{LEAVE_TYPE_LABELS[step.leave_type] ?? step.leave_type}</div>
                          <div className="cell-sub">
                            {formatDate(step.start_date)}{info.endDate ? ` → ${formatDate(info.endDate)}` : ''} · {step.duration} j
                          </div>
                        </td>
                        <td>
                          {info.isDirectTarget ? (
                            <span className="mini-badge" style={{ background: '#fef3c7', color: '#92400e' }}>
                              Assignée à vous
                            </span>
                          ) : (
                            <>
                              <div className="fw-medium">En attente de {info.targetName || info.targetRole}</div>
                              <div className="cell-sub">Cette étape peut être passée par un supérieur.</div>
                            </>
                          )}
                        </td>
                        <td className="text-end">
                          <button className="btn btn-sm btn-brand px-3" onClick={() => openDecision(step)}>
                            Traiter
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="18" y1="6" x2="6" y2="18" />
                </svg>
              </button>
            </div>

            <div className="decision-body">
              <div className="decision-info section-card mb-3">
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">Matricule</span>
                    <span className="detail-value">{selectedStep.matricule ?? '—'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Fonction</span>
                    <span className="detail-value">{selectedStep.fonction || '—'}</span>
                  </div>
                  {selectedStep.email && (
                    <div className="detail-item">
                      <span className="detail-label">Email</span>
                      <span className="detail-value">{selectedStep.email}</span>
                    </div>
                  )}
                  <div className="detail-item">
                    <span className="detail-label">Type</span>
                    <span className="detail-value">{LEAVE_TYPE_LABELS[selectedStep.leave_type] ?? selectedStep.leave_type}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Dates</span>
                    <span className="detail-value">
                      {formatDate(selectedStep.start_date)}
                      {selectedInfo.endDate ? ` → ${formatDate(selectedInfo.endDate)}` : ''} ({selectedStep.duration} j)
                    </span>
                  </div>
                  {selectedStep.reason_type && (
                    <div className="detail-item">
                      <span className="detail-label">Motif</span>
                      <span className="detail-value">{REASON_LABELS[selectedStep.reason_type] ?? selectedStep.reason_type}</span>
                    </div>
                  )}
                  {selectedInfo.creatorName && (
                    <div className="detail-item">
                      <span className="detail-label">Créée par</span>
                      <span className="detail-value">
                        {selectedInfo.creatorName}
                        {selectedInfo.creatorRole ? ` (${selectedInfo.creatorRole})` : ''}
                      </span>
                    </div>
                  )}
                  {selectedStep.url_justification && (
                    <div className="detail-item">
                      <span className="detail-label">Pièce justificative</span>
                      <span className="detail-value">
                        <a
                          href={`${api.defaults.baseURL}/request/${selectedStep.request_id}/document`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Ouvrir le document
                        </a>
                      </span>
                    </div>
                  )}
                </div>

                {selectedStep.justification && (
                  <div className="detail-item mt-3">
                    <span className="detail-label">Justification</span>
                    <span className="detail-value">{selectedStep.justification}</span>
                  </div>
                )}

                {selectedStep.leave_type === 'annual' && selectedStep.annualSplit && selectedStep.annualSplit.length > 0 && (
                  <div className="detail-item mt-3">
                    <span className="detail-label">Répartition annuelle</span>
                    <div className="d-flex flex-wrap gap-2 mt-1">
                      {selectedStep.annualSplit.map((allocation, index) => (
                        <span key={`${selectedStep.request_id}-${index}`} className="split-badge">
                          Exercice {allocation.year} : {allocation.daysAllocated} j
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div
                className="step-box"
                style={{ background: selectedInfo.isDirectTarget ? '#fef3c7' : 'var(--neutral-soft)' }}
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
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Approuver
                </button>
                <button
                  type="button"
                  className={`choice-btn reject ${decision === 'rejected' ? 'selected' : ''}`}
                  aria-pressed={decision === 'rejected'}
                  onClick={() => chooseDecision('rejected')}
                  disabled={isActioning}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
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
                  style={{
                    background: decision === 'approved' ? 'var(--success)' : decision === 'rejected' ? 'var(--danger)' : 'var(--muted)'
                  }}
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