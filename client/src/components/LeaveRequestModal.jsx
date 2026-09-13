import { useState, useMemo, useEffect } from 'react';
import axios from 'axios';

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

function isvalidDate(startDateValue, endDateValue) {
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

  if (start < today || end < today) {
    throw new Error('Les dates de début et de fin doivent être dans le futur.');
  }

  if (start > end) {
    throw new Error('La date de début doit être antérieure ou égale à la date de fin.');
  }

  return true;
}
async function getInformation() {
  const response = await axios.get('http://localhost:5000/api/profile/me', {
    withCredentials: true
  });
  return response.data;
}

function LeaveRequestModal({ onClose, onSuccess }) {
  const [leaveType, setLeaveType] = useState('annual');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reasonType, setReasonType] = useState('medical');
  const [justification, setJustification] = useState('');
  const [sendToDepartmentHead, setSendToDepartmentHead] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    let isMounted = true;

    getInformation()
      .then((user) => {
        if (isMounted) setCurrentUser(user);
      })
      .catch(() => {
        if (isMounted) setCurrentUser(null);
      });

    return () => {
      isMounted = false;
    };
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
      isvalidDate(startDate, endDate);
    } catch (validationError) {
      setError(validationError.message);
      return;
    }

    if (duration <= 0) {
      setError('Veuillez sélectionner des dates valides.');
      return;
    }
    if (needsJustification && !justification.trim()) {
      setError('Une justification est requise pour ce type de congé.');
      return;
    }

    setSubmitting(true);
    try {
      await axios.post(
        'http://localhost:5000/api/request',
        {
          startDate,
          duration,
          leaveType,
          reasonType: needsJustification ? reasonType : null,
          justification: needsJustification ? justification.trim() : null,
          sendToDepartmentHead,
          directToDepartmentHead: sendToDepartmentHead
        },
        { withCredentials: true }
      );
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
      className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
      style={{ background: 'rgba(15, 23, 42, 0.45)', zIndex: 1050 }}
      onClick={onClose}
    >
      <div
        className="bg-white shadow rounded-4 overflow-hidden"
        style={{ width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ height: '6px', backgroundColor: '#0d6efd' }} />

        <div className="p-4 p-md-5">
          <div className="d-flex align-items-center justify-content-between mb-4">
            <h2 className="h4 fw-bold mb-0">Nouvelle demande de congé</h2>
            <button
              type="button"
              className="btn btn-light border-0 rounded-3"
              onClick={onClose}
              aria-label="Fermer"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-3">
              <label className="form-label fw-medium">Type de congé</label>
              <select
                className="form-select form-select-lg"
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value)}
              >
                {LEAVE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div className="row g-3 mb-3">
              <div className="col-6">
                <label className="form-label fw-medium">Date de début</label>
                <input
                  type="date"
                  className="form-control form-control-lg"
                  value={startDate}
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
                  min={startDate || undefined}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <p className="text-muted mb-4">
              Durée calculée : <strong>{duration} jour(s)</strong>
            </p>

            {needsJustification && (
              <>
                <div className="mb-3">
                  <label className="form-label fw-medium">Motif</label>
                  <select
                    className="form-select form-select-lg"
                    value={reasonType}
                    onChange={(e) => setReasonType(e.target.value)}
                  >
                    {REASON_TYPES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
                <div className="mb-4">
                  <label className="form-label fw-medium">Justification</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={justification}
                    onChange={(e) => setJustification(e.target.value)}
                  />
                </div>
              </>
            )}

            {!needsJustification && (
              <div className="mb-4">
                <label className="form-label fw-medium">Commentaire (facultatif)</label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                />
              </div>
            )}

            {showDepartmentHeadOption && (
              <div className="form-check mb-4">
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

            {error && (
              <div className="alert alert-danger py-2 small" role="alert">
                {error}
              </div>
            )}

            <div className="d-flex justify-content-end gap-2">
              <button type="button" className="btn btn-outline-secondary btn-lg" onClick={onClose}>
                Annuler
              </button>
              <button type="submit" className="btn btn-primary btn-lg" disabled={submitting}>
                {submitting ? 'Envoi...' : 'Envoyer la demande'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default LeaveRequestModal;