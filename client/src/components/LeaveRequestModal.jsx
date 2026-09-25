import { useState, useMemo, useEffect, useRef } from 'react';
import api from './api';
import './LeaveRequestModal.css';

const LEAVE_TYPES = [
  { value: 'annual', label: 'Congé annuel' },
  { value: 'exceptional', label: 'Congé exceptionnel' },
  { value: 'advance', label: 'Avance sur congé' }
];

const REASON_TYPES = [
  { value: 'medical', label: 'Médical' },
  { value: 'family_event', label: 'Événement familial' },
  { value: 'other', label: 'Autre' }
];

function diffInDays(start, end) {
  if (!start || !end) return 0;
  const s = new Date(start);
  const e = new Date(end);
  const diff = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1; // inclusive
  return diff > 0 ? diff : 0;
}

// Returns the approved leave (as a from/to range) that overlaps the chosen dates, or null
function findApprovedOverlap(leaveRequests, startDateValue, endDateValue) {
  const newStart = new Date(startDateValue);
  const newEnd = new Date(endDateValue);
  for (const lr of leaveRequests ?? []) {
    if (lr.status !== 'approved') continue;
    const startDateStr = lr.startDate ? String(lr.startDate).split('T')[0] : '';
    if (!startDateStr) continue;
    const from = new Date(startDateStr);
    const to = new Date(from);
    to.setDate(to.getDate() + Number(lr.duration) - 1);
    if (newStart <= to && newEnd >= from) return { from, to };
  }
  return null;
}

// One message per field. An empty object means the form is valid.
function validateForm({ startDate, endDate, allowPast, needsJustification, justification, leaveRequests }) {
  const errors = {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;
  const startOk = start && !Number.isNaN(start.getTime());
  const endOk = end && !Number.isNaN(end.getTime());

  if (!start) errors.startDate = 'Choisissez une date de début.';
  else if (!startOk) errors.startDate = "La date de début n'est pas valide.";
  else if (!allowPast && start < today) errors.startDate = 'La date de début ne peut pas être dans le passé.';

  if (!end) errors.endDate = 'Choisissez une date de fin.';
  else if (!endOk) errors.endDate = "La date de fin n'est pas valide.";
  else if (!allowPast && end < today) errors.endDate = 'La date de fin ne peut pas être dans le passé.';
  else if (startOk && start > end) errors.endDate = 'La date de fin doit être le même jour ou après la date de début.';

  if (!errors.startDate && !errors.endDate) {
    const overlap = findApprovedOverlap(leaveRequests, startDate, endDate);
    if (overlap) {
      errors.range = `Ces dates chevauchent un congé déjà approuvé (du ${overlap.from.toLocaleDateString('fr-FR')} au ${overlap.to.toLocaleDateString('fr-FR')}). Choisissez d'autres dates.`;
    }
  }

  if (needsJustification && !justification.trim()) {
    errors.justification = 'Expliquez le motif de votre congé exceptionnel.';
  }

  return errors;
}

// Message shown under a field, with an icon so it is easy to spot
function FieldError({ id, message }) {
  if (!message) return null;
  return (
    <div id={id} className="field-error" role="alert">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span>{message}</span>
    </div>
  );
}

// Small stack of auto-dismissing warning toasts, used for date-related
// problems instead of printing them as red text under the field — the field
// still gets a red border so it's clear which input is at fault, but the
// explanation surfaces as a toast that's easy to notice and easy to dismiss.
function ToastStack({ toasts, onDismiss }) {
  if (toasts.length === 0) return null;
  return (
    <div className="leave-toast-stack" role="alert" aria-live="assertive">
      {toasts.map((toast) => (
        <div key={toast.id} className="leave-toast">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>{toast.message}</span>
          <button type="button" className="leave-toast-close" onClick={() => onDismiss(toast.id)} aria-label="Fermer">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}

async function getInformation(targetEmployeeId) {
  const response = await api.get(targetEmployeeId ? `/profile/${targetEmployeeId}` : '/profile/me');
  return response.data;
}

function LeaveRequestModal({ onClose, onSuccess, targetEmployeeId = null, targetEmployeeName = '' }) {
  const [leaveType, setLeaveType] = useState('annual');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reasonType, setReasonType] = useState('medical');
  const [justification, setJustification] = useState('');
  const [justificationDocument, setJustificationDocument] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState({});

  useEffect(() => {
    let isMounted = true;
    getInformation(targetEmployeeId)
      .then((user) => { if (isMounted) setCurrentUser(user); })
      .catch(() => { if (isMounted) setCurrentUser(null); });
    return () => { isMounted = false; };
  }, [targetEmployeeId]);

  const duration = useMemo(() => diffInDays(startDate, endDate), [startDate, endDate]);
  const needsJustification = leaveType === 'exceptional';
  const allowsJustificationDocument = ['exceptional', 'advance'].includes(leaveType);

  const errors = useMemo(
    () => validateForm({
      startDate,
      endDate,
      allowPast: needsJustification,
      needsJustification,
      justification,
      leaveRequests: currentUser?.leaveRequests
    }),
    [startDate, endDate, needsJustification, justification, currentUser]
  );
  const errorCount = Object.keys(errors).length;

  // A field's error is shown once the user has touched it, or after a first submit attempt
  const visibleError = (name) => (submitted || touched[name] ? errors[name] : '');
  const touch = (name) => setTouched((prev) => ({ ...prev, [name]: true }));

  // Date-related problems (bad/missing dates, end before start, overlap with an
  // approved leave) surface as toasts rather than red text under the field.
  const [toasts, setToasts] = useState([]);
  const toastTimers = useRef({});
  const lastDateErrorRef = useRef({ startDate: '', endDate: '', range: '' });

  function pushToast(message) {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message }]);
    toastTimers.current[id] = setTimeout(() => dismissToast(id), 5000);
  }
  function dismissToast(id) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    clearTimeout(toastTimers.current[id]);
    delete toastTimers.current[id];
  }
  useEffect(() => () => {
    Object.values(toastTimers.current).forEach(clearTimeout);
  }, []);

  useEffect(() => {
    const isRangeVisible = submitted || (touched.startDate && touched.endDate);
    const next = {
      startDate: (submitted || touched.startDate) ? (errors.startDate || '') : '',
      endDate: (submitted || touched.endDate) ? (errors.endDate || '') : '',
      range: isRangeVisible ? (errors.range || '') : ''
    };
    ['startDate', 'endDate', 'range'].forEach((field) => {
      if (next[field] && next[field] !== lastDateErrorRef.current[field]) {
        pushToast(next[field]);
      }
    });
    lastDateErrorRef.current = next;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errors.startDate, errors.endDate, errors.range, submitted, touched.startDate, touched.endDate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitted(true);

    const firstInvalid = ['startDate', 'endDate', 'range', 'justification'].find((name) => errors[name]);
    if (firstInvalid) {
      const fieldIds = {
        startDate: 'leave-start-date',
        endDate: 'leave-end-date',
        range: 'leave-start-date',
        justification: 'leave-justification'
      };
      document.getElementById(fieldIds[firstInvalid])?.focus();
      return;
    }

    setSubmitting(true);
    try {
      const requestData = new FormData();
      requestData.append('startDate', startDate);
      requestData.append('endDate', endDate);
      requestData.append('leaveType', leaveType);
      if (targetEmployeeId) {
        requestData.append('targetEmployeeId', String(targetEmployeeId));
      }
      requestData.append('reasonType', needsJustification ? reasonType : '');
      requestData.append('justification', justification.trim());
      if (justificationDocument) {
        requestData.append('justificationDocument', justificationDocument);
      }
      await api.post('/request', requestData);
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error ?? "Impossible d'envoyer la demande.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="leave-modal-overlay position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
      onClick={onClose}
    >
      <div
        className="leave-modal bg-white shadow-lg rounded-4 overflow-hidden"
        style={{ width: '100%', maxWidth: '760px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <ToastStack toasts={toasts} onDismiss={dismissToast} />
        <div className="leave-modal-header">
          <div className="accent-bar" />
          <div className="d-flex align-items-center justify-content-between px-4 px-md-5 pt-4 pb-3">
            <div>
              <h2 className="h4 fw-bold mb-0">Nouvelle demande de congé</h2>
              {targetEmployeeId && targetEmployeeName && (
                <p className="muted-note mb-0 mt-1">Pour : {targetEmployeeName}</p>
              )}
            </div>
            <button type="button" className="close-btn" style={{ width: 36, height: 36 }} onClick={onClose} aria-label="Fermer">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
            </button>
          </div>
        </div>

        <div className="leave-modal-body px-4 px-md-5 py-4">
          <form id="leave-request-form" onSubmit={handleSubmit} noValidate>
            <div className="row g-3 mb-3">
              <div className="col-12 col-md-6">
                <label className="form-label fw-medium" htmlFor="leave-type">Type de congé</label>
                <select id="leave-type" className="form-select form-select-lg" value={leaveType} onChange={(e) => setLeaveType(e.target.value)}>
                  {LEAVE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              {needsJustification && (
                <div className="col-12 col-md-6">
                  <label className="form-label fw-medium" htmlFor="leave-reason">Motif</label>
                  <select id="leave-reason" className="form-select form-select-lg" value={reasonType} onChange={(e) => setReasonType(e.target.value)}>
                    {REASON_TYPES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="row g-3 mb-3">
              <div className="col-12 col-sm-6">
                <label className="form-label fw-medium" htmlFor="leave-start-date">
                  Date de début <span className="required-mark">*</span>
                </label>
                <input
                  id="leave-start-date"
                  type="date"
                  className={`form-control form-control-lg ${visibleError('startDate') ? 'has-error' : ''}`}
                  value={startDate}
                  min={leaveType === 'exceptional' ? undefined : new Date().toISOString().slice(0, 10)}
                  onChange={(e) => { setStartDate(e.target.value); touch('startDate'); }}
                  onBlur={() => touch('startDate')}
                  aria-invalid={Boolean(visibleError('startDate'))}
                  required
                />
              </div>
              <div className="col-12 col-sm-6">
                <label className="form-label fw-medium" htmlFor="leave-end-date">
                  Date de fin <span className="required-mark">*</span>
                </label>
                <input
                  id="leave-end-date"
                  type="date"
                  className={`form-control form-control-lg ${visibleError('endDate') ? 'has-error' : ''}`}
                  value={endDate}
                  min={startDate || (leaveType === 'exceptional' ? undefined : new Date().toISOString().slice(0, 10))}
                  onChange={(e) => { setEndDate(e.target.value); touch('endDate'); }}
                  onBlur={() => touch('endDate')}
                  aria-invalid={Boolean(visibleError('endDate'))}
                  required
                />
              </div>
            </div>

            <p className="duration-note mb-4">
              Durée calculée : <strong style={{ color: 'var(--ink)' }}>{duration > 0 ? `${duration} jour(s)` : '—'}</strong>
            </p>

            <div className="mb-4">
              <label className="form-label fw-medium" htmlFor="leave-justification">
                Justification {needsJustification && <span className="required-mark">*</span>}
              </label>
              <textarea
                id="leave-justification"
                className={`form-control ${visibleError('justification') ? 'has-error' : ''}`}
                rows={4}
                value={justification}
                onChange={(e) => { setJustification(e.target.value); touch('justification'); }}
                onBlur={() => touch('justification')}
                aria-invalid={Boolean(visibleError('justification'))}
                aria-describedby={visibleError('justification') ? 'leave-justification-error' : undefined}
                placeholder={needsJustification ? 'Expliquez le motif de votre congé exceptionnel...' : 'Ajoutez un commentaire (facultatif)...'}
                required={needsJustification}
              />
              {visibleError('justification') ? (
                <FieldError id="leave-justification-error" message={visibleError('justification')} />
              ) : (
                <div className="form-text field-hint">
                  {needsJustification
                    ? 'Obligatoire pour un congé exceptionnel.'
                    : leaveType === 'advance'
                      ? 'Facultatif pour un congé par anticipation.'
                      : 'Facultatif pour ce type de congé.'}
                </div>
              )}

              {allowsJustificationDocument && (
                <>
                  <label className="form-label fw-medium mt-3" htmlFor="justificationDocument">Document justificatif (facultatif)</label>
                  <input
                    id="justificationDocument"
                    type="file"
                    className="form-control"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    onChange={(e) => setJustificationDocument(e.target.files?.[0] ?? null)}
                  />
                  <div className="form-text">PDF, image, DOC ou DOCX, 5 Mo maximum.</div>
                </>
              )}
            </div>
          </form>
        </div>

        <div className="leave-modal-footer px-4 px-md-5 py-3">
          {(error || (submitted && errorCount > 0)) && (
            <div className="alert alert-danger py-2 small mb-3 d-flex align-items-start gap-2" role="alert">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none', marginTop: 1 }}>
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <div>
                <strong className="d-block">
                  {error
                    ? "La demande n'a pas pu être envoyée"
                    : errorCount === 1 ? '1 point à corriger' : `${errorCount} points à corriger`}
                </strong>
                {error || 'Les champs concernés sont entourés en rouge.'}
              </div>
            </div>
          )}
          <div className="d-flex justify-content-end gap-2">
            <button type="button" className="btn btn-outline-neutral btn-lg" onClick={onClose}>
              Annuler
            </button>
            <button type="submit" form="leave-request-form" className="btn btn-primary-solid btn-lg" disabled={submitting}>
              {submitting ? 'Envoi...' : 'Envoyer la demande'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LeaveRequestModal;