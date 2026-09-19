import { useState, useMemo, useEffect } from 'react';
import api from './api';

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

function isvalidDate(startDateValue, endDateValue, allowPast) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = new Date(startDateValue);
  const end = new Date(endDateValue);

  if (!startDateValue || !endDateValue) {
    throw new Error('Veuillez sélectionner une date de début et une date de fin.');
  }

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error('Les dates sélectionnées ne sont pas valides.');
  }

  if (!allowPast && (start < today || end < today)) {
    throw new Error('Les dates de début et de fin doivent être dans le futur.');
  }

  if (start > end) {
    throw new Error('La date de début doit être antérieure ou égale à la date de fin.');
  }

  return true;
}

async function getInformation() {
  const response = await api.get('/profile/me');
  return response.data;
}

function LeaveRequestModal({ onClose, onSuccess }) {
  const [leaveType, setLeaveType] = useState('annual');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reasonType, setReasonType] = useState('medical');
  const [justification, setJustification] = useState('');
  const [justificationDocument, setJustificationDocument] = useState(null);
  const [sendToDepartmentHead, setSendToDepartmentHead] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    let isMounted = true;
    getInformation()
      .then((user) => { if (isMounted) setCurrentUser(user); })
      .catch(() => { if (isMounted) setCurrentUser(null); });
    return () => { isMounted = false; };
  }, []);

  const duration = useMemo(() => diffInDays(startDate, endDate), [startDate, endDate]);
  const needsJustification = leaveType === 'exceptional';
  const showDepartmentHeadOption =
    currentUser?.role === 'employee' &&
    ['service', 'section'].includes(currentUser?.unit?.type);

  useEffect(() => {
    if (!showDepartmentHeadOption) {
      setSendToDepartmentHead(false);
    }
  }, [showDepartmentHeadOption]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    try {
      isvalidDate(startDate, endDate, needsJustification);
    } catch (validationError) {
      setError(validationError.message);
      return;
    }

    if (duration <= 0) {
      setError('Veuillez sélectionner des dates valides.');
      return;
    }

    if (currentUser?.leaveRequests) {
      const newStart = new Date(startDate);
      const newEnd = new Date(endDate);
      const approvedOverlap = currentUser.leaveRequests.find((lr) => {
        if (lr.status !== 'approved') return false;
        const startDateStr = lr.startDate ? String(lr.startDate).split('T')[0] : '';
        if (!startDateStr) return false;
        const existingStart = new Date(startDateStr);
        const existingEnd = new Date(existingStart);
        existingEnd.setDate(existingEnd.getDate() + Number(lr.duration) - 1);
        return newStart <= existingEnd && newEnd >= existingStart;
      });

      if (approvedOverlap) {
        const overlapStart = String(approvedOverlap.startDate).split('T')[0];
        setError(`La période sélectionnée chevauche un congé déjà approuvé (du ${new Date(overlapStart).toLocaleDateString('fr-FR')} pour ${approvedOverlap.duration} jour(s)).`);
        return;
      }
    }

    if (needsJustification && !justification.trim()) {
      setError('Une justification est requise pour ce type de congé.');
      return;
    }

    setSubmitting(true);
    try {
      const requestData = new FormData();
      requestData.append('startDate', startDate);
      requestData.append('endDate', endDate);
      requestData.append('leaveType', leaveType);
      requestData.append('reasonType', needsJustification ? reasonType : '');
      requestData.append('justification', justification.trim());
      requestData.append('sendToDepartmentHead', String(sendToDepartmentHead));
      requestData.append('directToDepartmentHead', String(sendToDepartmentHead));
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
      <style>{`
        .leave-modal-overlay { background: rgba(15, 23, 42, 0.45); z-index: 1050; padding: 24px; }
        .leave-modal {
          --ink: #1B2430;
          --muted: #65707D;
          --surface: #FFFFFF;
          --border: #E4E8ED;
          --primary: #1F5673;
          display: flex;
          flex-direction: column;
          max-height: 92vh;
        }
        .leave-modal .accent-bar { height: 6px; background: var(--primary); flex: none; }
        .leave-modal-header {
          position: sticky;
          top: 0;
          background: var(--surface);
          z-index: 2;
          flex: none;
        }
        .leave-modal h2 { color: var(--ink); }
        .leave-modal .close-btn { border: none; background: #F2F5F8; color: var(--muted); border-radius: 10px; }
        .leave-modal-body {
          overflow-y: auto;
          flex: 1 1 auto;
          scrollbar-color: var(--primary) #EEF1F4;
          scrollbar-width: thin;
        }
        .leave-modal-body::-webkit-scrollbar { width: 10px; }
        .leave-modal-body::-webkit-scrollbar-track { background: #EEF1F4; }
        .leave-modal-body::-webkit-scrollbar-thumb { background: var(--primary); border-radius: 8px; border: 2px solid #EEF1F4; }
        .leave-modal .duration-note { color: var(--muted); }
        .leave-modal .required-mark { color: #B3261E; }
        .leave-modal .field-hint { color: var(--muted); }
        .leave-modal-footer {
          position: sticky;
          bottom: 0;
          background: var(--surface);
          border-top: 1px solid var(--border);
          z-index: 2;
          flex: none;
        }
        .leave-modal .btn-primary-solid {
          background: var(--primary); color: #fff; border: none;
        }
        .leave-modal .btn-primary-solid:disabled { opacity: 0.6; }
        .leave-modal .btn-outline-neutral { border: 1px solid var(--border); color: var(--ink); background: #fff; }
      `}</style>

      <div
        className="leave-modal bg-white shadow-lg rounded-4 overflow-hidden"
        style={{ width: '100%', maxWidth: '640px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="leave-modal-header">
          <div className="accent-bar" />
          <div className="d-flex align-items-center justify-content-between px-4 px-md-5 pt-4 pb-3">
            <h2 className="h4 fw-bold mb-0">Nouvelle demande de congé</h2>
            <button type="button" className="close-btn" style={{ width: 36, height: 36 }} onClick={onClose} aria-label="Fermer">
              ✕
            </button>
          </div>
        </div>

        <div className="leave-modal-body px-4 px-md-5 py-4">
          <form id="leave-request-form" onSubmit={handleSubmit} noValidate>
            <div className="row g-3 mb-3">
              <div className="col-12 col-md-6">
                <label className="form-label fw-medium">Type de congé</label>
                <select className="form-select form-select-lg" value={leaveType} onChange={(e) => setLeaveType(e.target.value)}>
                  {LEAVE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              {needsJustification && (
                <div className="col-12 col-md-6">
                  <label className="form-label fw-medium">Motif</label>
                  <select className="form-select form-select-lg" value={reasonType} onChange={(e) => setReasonType(e.target.value)}>
                    {REASON_TYPES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="row g-3 mb-3">
              <div className="col-6">
                <label className="form-label fw-medium">Date de début</label>
                <input
                  type="date"
                  className="form-control form-control-lg"
                  value={startDate}
                  min={leaveType === 'exceptional' ? undefined : new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>
              <div className="col-6">
                <label className="form-label fw-medium">Date de fin</label>
                <input
                  type="date"
                  className="form-control form-control-lg"
                  value={endDate}
                  min={startDate || (leaveType === 'exceptional' ? undefined : new Date().toISOString().slice(0, 10))}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <p className="duration-note mb-4">
              Durée calculée : <strong style={{ color: 'var(--ink)' }}>{duration} jour(s)</strong>
            </p>

            <div className="mb-4">
              <label className="form-label fw-medium">
                Justification {needsJustification && <span className="required-mark">*</span>}
              </label>
              <textarea
                className="form-control"
                rows={4}
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder={needsJustification ? 'Expliquez le motif de votre congé exceptionnel...' : 'Ajoutez un commentaire (facultatif)...'}
                required={needsJustification}
              />
              <div className="form-text field-hint">
                {needsJustification
                  ? 'Obligatoire pour un congé exceptionnel.'
                  : 'Facultatif pour ce type de congé.'}
              </div>

              {needsJustification && (
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

            {showDepartmentHeadOption && (
              <div className="form-check mb-2">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="sendToDepartmentHead"
                  checked={sendToDepartmentHead}
                  onChange={(e) => setSendToDepartmentHead(e.target.checked)}
                />
                <label className="form-check-label" htmlFor="sendToDepartmentHead">
                  Envoyer directement au responsable de département
                </label>
              </div>
            )}
          </form>
        </div>

        <div className="leave-modal-footer px-4 px-md-5 py-3">
          {error && (
            <div className="alert alert-danger py-2 small mb-3" role="alert">
              {error}
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