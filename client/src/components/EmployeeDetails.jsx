import { Fragment, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from './api';
import Header from './header';

const LEAVE_TYPE_LABELS = {
  annual: 'Congé annuel',
  exceptional: 'Congé exceptionnel',
  advance: 'Avance sur congé',
};

const ROLE_LABELS = {
  admin: 'Administrateur',
  head: 'Chef',
  hr: 'RH',
  employee: 'Employé',
  directeur: 'Directeur',
  chef_departement: 'Chef de département',
  chef_service: 'Chef de service',
  drh: 'DRH',
  employe: 'Employé',
};

const STEP_ROLE_OPTIONS = ['chef_service', 'chef_departement', 'directeur', 'drh'];

const STATUS_LABELS = {
  pending: 'En attente',
  approved: 'Approuvée',
  rejected: 'Refusée',
  cancelled: 'Annulée',
  'time out': 'Expirée',
};

const STATUS_STYLES = {
  pending: { bg: '#FFF2C7', fg: '#AF5B00' },
  approved: { bg: '#C8F7E5', fg: '#008B68' },
  rejected: { bg: '#FBEAE8', fg: '#C1544A' },
  cancelled: { bg: '#EEF1F4', fg: '#65707D' },
  'time out': { bg: '#EEF1F4', fg: '#65707D' },
};

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('fr-FR');
}

function getEndDate(startDate, duration) {
  if (!startDate) return null;
  const date = new Date(startDate);
  date.setDate(date.getDate() + (Number(duration) || 0) - 1);
  return date;
}

function initialsOf(firstName, lastName) {
  return `${(firstName || '').trim().charAt(0)}${(lastName || '').trim().charAt(0)}`.toUpperCase() || '?';
}

function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.cancelled;
  return (
    <span className="employee-details-status" style={{ background: style.bg, color: style.fg }}>
      <span className="employee-details-status-dot" style={{ background: style.fg }} />
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function Feedback({ status }) {
  if (!status) return null;
  return <div className={`employee-details-feedback ${status.type}`}>{status.message}</div>;
}

function ExerciseTable({ employeeId, exercises, onRefresh }) {
  const [showCreate, setShowCreate] = useState(false);
  const [year, setYear] = useState('');
  const [initialBalance, setInitialBalance] = useState('');
  const [editingYear, setEditingYear] = useState(null);
  const [balance, setBalance] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  async function handleCreate(event) {
    event.preventDefault();
    setLoading(true);
    setFeedback(null);
    try {
      await api.post('/admin/create-exercise-by-id', {
        empId: Number(employeeId),
        year: Number(year),
        balance: Number(initialBalance),
      });
      setYear('');
      setInitialBalance('');
      setShowCreate(false);
      setFeedback({ type: 'success', message: `Exercice ${year} créé.` });
      onRefresh();
    } catch (error) {
      setFeedback({ type: 'error', message: error.response?.data?.error || error.message });
    } finally {
      setLoading(false);
    }
  }

  async function handleBalanceUpdate(event) {
    event.preventDefault();
    setLoading(true);
    setFeedback(null);
    try {
      await api.post('/admin/update-exercise-balance', {
        empId: Number(employeeId),
        year: Number(editingYear),
        balance: Number(balance),
      });
      setEditingYear(null);
      setBalance('');
      setFeedback({ type: 'success', message: 'Solde mis à jour.' });
      onRefresh();
    } catch (error) {
      setFeedback({ type: 'error', message: error.response?.data?.error || error.message });
    } finally {
      setLoading(false);
    }
  }

  function startEditing(exercise) {
    setEditingYear(exercise.exercise);
    setBalance(exercise.balance);
    setFeedback(null);
  }

  return (
    <section className="employee-details-section">
      <div className="employee-details-section-heading">
        <h2>Exercices</h2>
        <button type="button" className="employee-details-primary" onClick={() => setShowCreate((open) => !open)}>
          {showCreate ? 'Annuler' : '+ Créer un exercice'}
        </button>
      </div>

      {showCreate && (
        <form className="employee-details-form" onSubmit={handleCreate}>
          <label htmlFor="exercise-year">Année fiscale</label>
          <input id="exercise-year" type="number" value={year} onChange={(event) => setYear(event.target.value)} placeholder="2026" required />
          <label htmlFor="exercise-balance">Solde initial (0 à 30 jours)</label>
          <input id="exercise-balance" type="number" min="0" max="30" step="0.5" value={initialBalance} onChange={(event) => setInitialBalance(event.target.value)} placeholder="0" required />
          <button type="submit" className="employee-details-primary" disabled={loading}>Créer</button>
        </form>
      )}

      {exercises.length === 0 ? (
        <p className="employee-details-muted">Aucun exercice trouvé pour cet employé.</p>
      ) : (
        <div className="table-responsive">
          <table className="table align-middle employee-details-table">
            <thead><tr><th>Exercice</th><th>Solde</th><th className="text-end">Action</th></tr></thead>
            <tbody>
              {exercises.map((exercise) => (
                <tr key={exercise.exercise}>
                  <td>{exercise.exercise}</td>
                  <td>{editingYear === exercise.exercise ? (
                    <form className="employee-details-inline-form" onSubmit={handleBalanceUpdate}>
                      <input type="number" step="0.5" value={balance} onChange={(event) => setBalance(event.target.value)} required aria-label={`Nouveau solde ${exercise.exercise}`} />
                      <button type="submit" className="employee-details-primary" disabled={loading}>Enregistrer</button>
                    </form>
                  ) : `${exercise.balance} j`}</td>
                  <td className="text-end">
                    {editingYear !== exercise.exercise && (
                      <button type="button" className="employee-details-secondary" onClick={() => startEditing(exercise)}>Modifier le solde</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Feedback status={feedback} />
    </section>
  );
}

export default function EmployeeDetails() {
  const { employeeId } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [requests, setRequests] = useState([]);
  const [requestError, setRequestError] = useState('');
  const [expandedRequests, setExpandedRequests] = useState({});
  const [stepEdits, setStepEdits] = useState({});
  const [updatingStep, setUpdatingStep] = useState(null);

  async function fetchDetail() {
    setLoading(true);
    try {
      const response = await api.get(`/profile/${employeeId}`);
      setDetail(response.data);
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Impossible de charger les informations de cet employé.');
    } finally {
      setLoading(false);
    }
  }

  async function fetchRequests() {
    try {
      const response = await api.get(`/admin/leave-requests/employee/${employeeId}`);
      setRequests(response.data ?? []);
      setRequestError('');
    } catch (requestErrorResponse) {
      setRequestError(requestErrorResponse.response?.data?.error || 'Impossible de charger les étapes des demandes.');
    }
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => {
    fetchDetail();
    fetchRequests();
  }, [employeeId]);

  function updateStepEdit(stepId, field, value) {
    setStepEdits((current) => ({
      ...current,
      [stepId]: { ...current[stepId], [field]: value },
    }));
  }

  async function handleStepUpdate(step, field) {
    const value = stepEdits[step.step_id]?.[field];
    if (!value) return;

    setUpdatingStep(`${step.step_id}-${field}`);
    try {
      const endpoint = field === 'newRole'
        ? '/admin/update-request-step-target'
        : '/admin/update-request-step-decision';
      await api.post(endpoint, { stepId: step.step_id, [field]: value });
      await fetchRequests();
      setStepEdits((current) => ({ ...current, [step.step_id]: {} }));
    } catch (requestErrorResponse) {
      setRequestError(requestErrorResponse.response?.data?.error || 'Impossible de mettre à jour cette étape.');
    } finally {
      setUpdatingStep(null);
    }
  }

  if (loading) return <><Header /><div className="employee-details-page"><p className="employee-details-muted">Chargement...</p></div></>;
  if (error || !detail) return <><Header /><div className="employee-details-page"><p className="employee-details-error">{error || 'Employé introuvable.'}</p><button type="button" className="employee-details-secondary" onClick={() => navigate('/admin')}>Retour aux employés</button></div></>;

  return (
    <div className="employee-details-page">
      <Header />
      <style>{`.employee-details-page{--ink:#1B2430;--muted:#65707D;--surface:#FFF;--canvas:#F5F7FA;--border:#E4E8ED;--primary:#1F5673;min-height:100vh;background:var(--canvas);color:var(--ink);padding:2rem 1rem}.employee-details-shell{max-width:1100px;margin:0 auto}.employee-details-header{display:flex;justify-content:space-between;align-items:center;gap:1rem;background:#E8F0F4;border:1px solid var(--border);border-radius:14px;padding:1.5rem;margin-bottom:1rem}.employee-details-identity{display:flex;align-items:center;gap:1rem}.employee-details-avatar{width:52px;height:52px;border-radius:50%;background:var(--primary);color:#fff;display:grid;place-items:center;font-weight:700}.employee-details-muted{color:var(--muted);font-size:.9rem}.employee-details-header p,.employee-details-header h1{margin:0}.employee-details-card,.employee-details-section{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:1.5rem;margin-bottom:1rem}.employee-details-info{display:grid;grid-template-columns:repeat(4,1fr);gap:1rem}.employee-details-info dt{color:var(--muted);font-size:.8rem}.employee-details-info dd{margin:.25rem 0 0;font-weight:600}.employee-details-section-heading{display:flex;justify-content:space-between;align-items:center;gap:1rem;margin-bottom:1rem}.employee-details-section h2{font-size:1.1rem;margin:0}.employee-details-table th{color:var(--muted);font-size:.78rem;text-transform:uppercase}.employee-details-primary,.employee-details-secondary{border-radius:9px;padding:.45rem .8rem;font-weight:600;font-size:.85rem;cursor:pointer}.employee-details-primary{background:var(--primary);color:#fff;border:1px solid var(--primary)}.employee-details-secondary{background:#fff;color:var(--primary);border:1px solid var(--primary)}.employee-details-form,.employee-details-inline-form{display:flex;align-items:end;gap:.6rem;flex-wrap:wrap;background:#FAFBFC;border:1px solid var(--border);border-radius:10px;padding:1rem;margin-bottom:1rem}.employee-details-form label{width:100%;font-size:.85rem;font-weight:600}.employee-details-form input,.employee-details-inline-form input{border:1px solid var(--border);border-radius:8px;padding:.45rem .6rem;width:130px}.employee-details-feedback{margin-top:.75rem;padding:.6rem .8rem;border-radius:8px;font-size:.85rem}.employee-details-feedback.success{background:#E7F4EC;color:#3E8A5F}.employee-details-feedback.error,.employee-details-error{background:#FBEAE8;color:#C1544A;padding:.7rem;border-radius:8px}.employee-details-status{display:inline-flex;align-items:center;gap:5px;padding:.3rem .6rem;border-radius:999px;font-size:.8rem;font-weight:600}.employee-details-status-dot{width:6px;height:6px;border-radius:50%}@media(max-width:700px){.employee-details-info{grid-template-columns:repeat(2,1fr)}.employee-details-header{align-items:flex-start;flex-direction:column}}`}</style>
      <style>{`.employee-details-step-panel{background:#FAFBFC;border-top:1px solid var(--border);padding:.75rem}.employee-details-step-row{display:grid;grid-template-columns:minmax(180px,1fr) auto minmax(280px,1.4fr);align-items:center;gap:1rem;padding:.75rem 0;border-bottom:1px solid var(--border)}.employee-details-step-row:last-child{border-bottom:0}.employee-details-step-editor{display:flex;flex-wrap:wrap;gap:.5rem}.employee-details-step-editor select{min-width:155px;border:1px solid var(--border);border-radius:7px;padding:.4rem}@media(max-width:700px){.employee-details-step-row{grid-template-columns:1fr;gap:.5rem}}`}</style>
      <style>{`.employee-details-page{--ink:#050505;--muted:#55708f;--surface:#FFF;--canvas:#F8FAFC;--border:#DCE5EF;--primary:#0867D8;--primary-soft:#F3F7FD;background:var(--canvas);padding:2rem 1rem}.employee-details-shell{max-width:1180px}.employee-details-header{background:var(--primary-soft);border-radius:20px;box-shadow:0 2px 4px rgba(27,36,48,.08)}.employee-details-card,.employee-details-section{border-radius:20px;box-shadow:0 2px 4px rgba(27,36,48,.08)}.employee-details-table th{background:#F5F8FB;padding:1rem 1.1rem}.employee-details-table td{padding:1rem 1.1rem}.employee-details-primary{background:var(--primary);border-color:var(--primary)}.employee-details-secondary{border-color:var(--border)}.employee-details-form,.employee-details-inline-form{background:#F5F8FB;border-radius:12px}.employee-details-step-panel{background:#F8FAFC}.employee-details-step-editor select{border-color:var(--border);border-radius:8px}@media(max-width:700px){.employee-details-page{padding:1rem .75rem}.employee-details-header{align-items:flex-start;flex-direction:column}.employee-details-info{grid-template-columns:repeat(2,1fr)}}@media(max-width:480px){.employee-details-info{grid-template-columns:1fr}}`}</style>
      <div className="employee-details-shell">
        <header className="employee-details-header">
          <div className="employee-details-identity">
            <div className="employee-details-avatar">{initialsOf(detail.firstName, detail.lastName)}</div>
            <div><h1>{detail.firstName} {detail.lastName}</h1><p className="employee-details-muted">{detail.roleLabel ?? ROLE_LABELS[detail.role] ?? detail.role}</p></div>
          </div>
          <button type="button" className="employee-details-secondary" onClick={() => navigate('/admin')}>Retour aux employés</button>
        </header>

        <div className="employee-details-card employee-details-info">
          <div><dt>Matricule</dt><dd>{detail.matricule ?? '—'}</dd></div>
          <div><dt>Email</dt><dd>{detail.email}</dd></div>
          <div><dt>Unité</dt><dd>{detail.unit?.name ?? '—'}</dd></div>
          <div><dt>Type d'unité</dt><dd>{detail.unit?.type ?? '—'}</dd></div>
          <div><dt>Date de recrutement</dt><dd>{formatDate(detail.recrutement_date)}</dd></div>
        </div>

        <ExerciseTable employeeId={employeeId} exercises={detail.exercises ?? []} onRefresh={fetchDetail} />

        <section className="employee-details-section">
          <h2>Historique des demandes</h2>
          {requestError && <p className="employee-details-feedback error">{requestError}</p>}
          <div className="table-responsive">
            <table className="table align-middle employee-details-table">
              <thead><tr><th>ID</th><th>Type</th><th>Dates</th><th>Durée</th><th>Statut</th><th>Créée par</th><th className="text-end">Étapes</th></tr></thead>
              <tbody>{requests.map((request) => {
                const steps = request.steps ?? [];
                const lastStep = steps[steps.length - 1];
                const edit = stepEdits[lastStep?.step_id] ?? {};
                const endDate = getEndDate(request.start_date, request.duration);
                return <Fragment key={request.request_id}>
                  <tr>
                    <td>#{request.request_id}</td>
                    <td>{LEAVE_TYPE_LABELS[request.leave_type] ?? request.leave_type}</td>
                    <td>{formatDate(request.start_date)}{endDate ? ` → ${formatDate(endDate)}` : ''}</td>
                    <td>{request.duration} j</td>
                    <td><StatusBadge status={request.request_status} /></td>
                    <td>
                      {request.creator_first_name && request.creator_last_name
                        ? `${request.creator_first_name} ${request.creator_last_name}${request.creator_role ? ` (${ROLE_LABELS[request.creator_role] ?? request.creator_role})` : ''}`
                        : 'Employé'}
                    </td>
                    <td className="text-end"><button type="button" className="employee-details-secondary" onClick={() => setExpandedRequests((current) => ({ ...current, [request.request_id]: !current[request.request_id] }))}>{expandedRequests[request.request_id] ? 'Masquer' : 'Afficher'}</button></td>
                  </tr>
                  {expandedRequests[request.request_id] && <tr><td colSpan="7"><div className="employee-details-step-panel">
                    {steps.length === 0 ? <p className="employee-details-muted mb-0">Aucune étape.</p> : steps.map((step, index) => <div className="employee-details-step-row" key={step.step_id}>
                      <div><strong>Étape {step.step_order}</strong><div className="employee-details-muted">{step.target_first_name} {step.target_last_name} · {ROLE_LABELS[step.target_role] ?? step.target_role}</div></div>
                      <span className="employee-details-muted">{step.decision || 'En attente'}</span>
                      {index === steps.length - 1 && request.request_status === 'pending' && <div className="employee-details-step-editor">
                        <select value={edit.newRole ?? ''} onChange={(event) => updateStepEdit(step.step_id, 'newRole', event.target.value)} aria-label="Nouveau rôle"><option value="">Nouveau rôle</option>{STEP_ROLE_OPTIONS.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select>
                        <button type="button" className="employee-details-secondary" disabled={!edit.newRole || updatingStep === `${step.step_id}-newRole`} onClick={() => handleStepUpdate(step, 'newRole')}>Changer le rôle</button>
                        <select value={edit.decision ?? ''} onChange={(event) => updateStepEdit(step.step_id, 'decision', event.target.value)} aria-label="Nouvelle décision"><option value="">Nouvelle décision</option><option value="approved">Approuver</option><option value="rejected">Refuser</option></select>
                        <button type="button" className="employee-details-primary" disabled={!edit.decision || updatingStep === `${step.step_id}-decision`} onClick={() => handleStepUpdate(step, 'decision')}>Enregistrer</button>
                      </div>}
                    </div>)}
                  </div></td></tr>}
                </Fragment>;
              })}</tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}