import { useRef, useState } from 'react';
import api from './api';
import Header from './header';
import './ManualLeaveEntry.css';

const INITIAL_FORM = {
  startDate: '',
  endDate: '',
  leaveType: 'annual',
  reasonType: 'medical',
  justification: '',
  status: 'approved',
};

function getDuration(startDate, endDate) {
  if (!startDate || !endDate) return 0;
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  return Math.max(0, Math.round((end - start) / 86400000) + 1);
}

function formatDate(value) {
  if (!value) return 'Non renseignée';
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? 'Non renseignée' : date.toLocaleDateString('fr-FR');
}

export default function ManualLeaveEntry() {
  const [matricule, setMatricule] = useState('');
  const [employee, setEmployee] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [document, setDocument] = useState(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [formError, setFormError] = useState('');
  const [feedback, setFeedback] = useState('');
  const fileInput = useRef(null);

  async function handleLookup(event) {
    event.preventDefault();
    setLookupError('');
    setFormError('');
    setFeedback('');
    setEmployee(null);
    if (!/^\d+$/.test(matricule.trim())) {
      setLookupError('Saisissez un matricule numérique valide.');
      return;
    }

    setLookingUp(true);
    try {
      const response = await api.get(`/request/hr/employee/${encodeURIComponent(matricule.trim())}`);
      setEmployee(response.data);
      setForm(INITIAL_FORM);
      setDocument(null);
      if (fileInput.current) fileInput.current.value = '';
    } catch (error) {
      setLookupError(error.response?.data?.error || 'Impossible de trouver cet employé.');
    } finally {
      setLookingUp(false);
    }
  }

  function handleFormChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setFormError('');
    setFeedback('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError('');
    setFeedback('');

    if (!employee) {
      setFormError('Recherchez d’abord l’employé par matricule.');
      return;
    }
    if (!form.startDate || !form.endDate || getDuration(form.startDate, form.endDate) <= 0) {
      setFormError('Saisissez une période de congé valide.');
      return;
    }
    if (form.leaveType === 'exceptional' && !form.justification.trim()) {
      setFormError('La justification est obligatoire pour un congé exceptionnel.');
      return;
    }

    const payload = new FormData();
    payload.append('matricule', String(employee.matricule));
    payload.append('startDate', form.startDate);
    payload.append('endDate', form.endDate);
    payload.append('leaveType', form.leaveType);
    payload.append('reasonType', form.leaveType === 'exceptional' ? form.reasonType : '');
    payload.append('justification', form.justification.trim());
    payload.append('status', form.status);
    if (document) payload.append('justificationDocument', document);

    setSubmitting(true);
    try {
      const response = await api.post('/request/hr/manual', payload);
      const statusLabel = response.data.status === 'approved' ? 'approuvée' : 'refusée';
      setFeedback(`Demande n°${response.data.requestId} enregistrée et ${statusLabel}. L’employé a été notifié.`);
      setEmployee((current) => current ? { ...current, exercises: response.data.exercises } : current);
      setForm(INITIAL_FORM);
      setDocument(null);
      if (fileInput.current) fileInput.current.value = '';
    } catch (error) {
      setFormError(error.response?.data?.error || 'Impossible d’enregistrer cette demande.');
    } finally {
      setSubmitting(false);
    }
  }

  const duration = getDuration(form.startDate, form.endDate);

  return (
    <div className="leave-dashboard manual-leave-page">
      <Header />
      <main className="container py-4 manual-leave-main">
        <div className="manual-leave-heading">
          <p className="manual-leave-eyebrow">Ressources humaines</p>
          <h1 className="page-title mb-1">Saisie manuelle d’un congé</h1>
          <p className="text-muted mb-0">Enregistrer une demande déjà traitée, sans circuit d’approbation.</p>
        </div>

        <section className="manual-leave-section" aria-labelledby="manual-employee-heading">
          <h2 id="manual-employee-heading" className="section-title">1. Identifier l’employé</h2>
          <form className="manual-leave-lookup" onSubmit={handleLookup}>
            <label htmlFor="manual-matricule" className="form-label">Matricule</label>
            <div className="manual-leave-lookup-row">
              <input
                id="manual-matricule"
                className="form-control"
                inputMode="numeric"
                value={matricule}
                onChange={(event) => setMatricule(event.target.value)}
                placeholder="Saisir le matricule exact"
                required
              />
              <button className="btn btn-brand" type="submit" disabled={lookingUp}>
                {lookingUp ? 'Recherche…' : 'Rechercher'}
              </button>
            </div>
          </form>
          {lookupError && <p className="manual-leave-error" role="alert">{lookupError}</p>}

          {employee && (
            <div className="manual-employee-summary" aria-live="polite">
              <div className="manual-employee-details">
                <h3>{employee.firstName} {employee.lastName}</h3>
                <p>{employee.email} · Matricule {employee.matricule}</p>
                <p>{employee.jobTitle || 'Fonction non renseignée'} · {employee.unit?.name || 'Unité non renseignée'}</p>
                <p>Date d’entrée : {formatDate(employee.hireDate)}</p>
              </div>
              <div className="manual-exercise-balances">
                <h3>Soldes disponibles</h3>
                {employee.exercises.length === 0 ? (
                  <p>Aucun exercice enregistré.</p>
                ) : employee.exercises.map((exercise) => (
                  <span key={exercise.year}>{exercise.year}–{exercise.year + 1} : {exercise.balance} j</span>
                ))}
              </div>
            </div>
          )}
        </section>

        {employee && (
          <section className="manual-leave-section" aria-labelledby="manual-request-heading">
            <h2 id="manual-request-heading" className="section-title">2. Informations du congé et décision</h2>
            <form onSubmit={handleSubmit} noValidate>
              <div className="manual-leave-fields">
                <label className="manual-leave-field" htmlFor="manual-leave-type">
                  <span>Type de congé</span>
                  <select id="manual-leave-type" className="form-select" name="leaveType" value={form.leaveType} onChange={handleFormChange}>
                    <option value="annual">Congé annuel</option>
                    <option value="exceptional">Congé exceptionnel</option>
                    <option value="advance">Avance sur congé</option>
                  </select>
                </label>
                <label className="manual-leave-field" htmlFor="manual-leave-status">
                  <span>Statut final</span>
                  <select id="manual-leave-status" className="form-select" name="status" value={form.status} onChange={handleFormChange}>
                    <option value="approved">Approuvée</option>
                    <option value="rejected">Refusée</option>
                  </select>
                </label>
                <label className="manual-leave-field" htmlFor="manual-start-date">
                  <span>Date de début</span>
                  <input id="manual-start-date" className="form-control" type="date" name="startDate" value={form.startDate} onChange={handleFormChange} required />
                </label>
                <label className="manual-leave-field" htmlFor="manual-end-date">
                  <span>Date de fin</span>
                  <input id="manual-end-date" className="form-control" type="date" name="endDate" min={form.startDate || undefined} value={form.endDate} onChange={handleFormChange} required />
                </label>
                <div className="manual-leave-duration" aria-live="polite">
                  Durée calculée : <strong>{duration > 0 ? `${duration} jour${duration > 1 ? 's' : ''}` : '—'}</strong>
                </div>

                {form.leaveType === 'exceptional' && (
                  <>
                    <label className="manual-leave-field" htmlFor="manual-reason-type">
                      <span>Motif</span>
                      <select id="manual-reason-type" className="form-select" name="reasonType" value={form.reasonType} onChange={handleFormChange}>
                        <option value="medical">Médical</option>
                        <option value="family_event">Événement familial</option>
                        <option value="other">Autre</option>
                      </select>
                    </label>
                    <label className="manual-leave-field manual-leave-field-wide" htmlFor="manual-justification">
                      <span>Justification</span>
                      <textarea id="manual-justification" className="form-control" name="justification" rows="3" maxLength="500" value={form.justification} onChange={handleFormChange} required />
                    </label>
                  </>
                )}

                <label className="manual-leave-field manual-leave-field-wide" htmlFor="manual-justification-document">
                  <span>Document justificatif (facultatif)</span>
                  <input
                    ref={fileInput}
                    id="manual-justification-document"
                    className="form-control"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    onChange={(event) => setDocument(event.target.files?.[0] || null)}
                  />
                </label>
              </div>

              {formError && <p className="manual-leave-error" role="alert">{formError}</p>}
              {feedback && <p className="manual-leave-success" role="status">{feedback}</p>}
              <div className="manual-leave-actions">
                <button className="btn btn-brand" type="submit" disabled={submitting}>
                  {submitting ? 'Enregistrement…' : 'Enregistrer la demande'}
                </button>
              </div>
            </form>
          </section>
        )}
      </main>
    </div>
  );
}