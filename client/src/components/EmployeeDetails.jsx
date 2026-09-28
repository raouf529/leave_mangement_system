import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from './api';
import './EmployeeDetails.css';

/* ── helpers ── */
const ROLE_LABELS = {
  admin: 'Administrateur', head: 'Chef', hr: 'RH', employee: 'Employé',
  directeur: 'Directeur', chef_departement: 'Chef de département',
  chef_service: 'Chef de service', drh: 'DRH', employe: 'Employé',
};

/** fiscal-year start year: Jul–Jun */
function currentFiscalYear() {
  const now = new Date();
  return now.getMonth() < 6 ? now.getFullYear() - 1 : now.getFullYear();
}

function fiscalLabel(year) {
  return `${year}–${year + 1}`;
}

/* ── Toast (inline, lightweight) ── */
function useToast() {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);
  return { toasts, add };
}

function Toasts({ toasts }) {
  return (
    <div style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background: t.type === 'success' ? 'var(--success)' : 'var(--danger)',
          color: '#fff', padding: '0.75rem 1.25rem', borderRadius: '10px',
          fontSize: '0.88rem', fontWeight: 500, boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
        }}>
          {t.message}
        </div>
      ))}
    </div>
  );
}

/* ── Status badge ── */
function StatusBadge({ status }) {
  const map = {
    approved:  { bg: 'var(--success-soft)', color: 'var(--success)', label: 'Approuvé' },
    rejected:  { bg: 'var(--danger-soft)',  color: 'var(--danger)',  label: 'Refusé'   },
    pending:   { bg: 'var(--amber-soft)',   color: 'var(--accent-amber)', label: 'En attente' },
    cancelled: { bg: 'var(--neutral-soft)', color: 'var(--muted)', label: 'Annulé' },
  };
  const s = map[status] || { bg: 'var(--neutral-soft)', color: 'var(--muted)', label: status };
  return (
    <span style={{
      background: s.bg, color: s.color,
      padding: '0.2rem 0.6rem', borderRadius: '999px',
      fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap',
    }}>{s.label}</span>
  );
}

/* ══════════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════════ */
export default function EmployeeDetails() {
  const { employeeId } = useParams();
  const navigate = useNavigate();
  const { toasts, add: addToast } = useToast();

  const [employee, setEmployee] = useState(null);
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /* ── Exercise form ── */
  const maxYear = currentFiscalYear();
  const [formYear, setFormYear] = useState(String(maxYear));
  const [formBalance, setFormBalance] = useState('');
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState('');

  /* ── Fetch employee data ── */
  const fetchEmployee = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/profile/${employeeId}`);
      const data = res.data;
      setEmployee(data);
      setExercises(data.exercises ?? []);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => { fetchEmployee(); }, [fetchEmployee]);

  /* ── Submit exercise form ── */
  async function handleSaveExercise(e) {
    e.preventDefault();
    setFormError('');
    const year = parseInt(formYear, 10);
    const balance = parseFloat(formBalance);

    if (!Number.isInteger(year) || year > maxYear) {
      setFormError(`L'année doit être ≤ ${maxYear} (exercice courant).`);
      return;
    }
    if (isNaN(balance) || balance < 0 || balance > 30) {
      setFormError('Le solde doit être compris entre 0 et 30 jours.');
      return;
    }

    setFormSaving(true);
    try {
      const res = await api.post('/admin/manage-exercise', {
        empId: Number(employeeId),
        year,
        balance,
      });
      const action = res.data.action === 'create' ? 'créé' : 'mis à jour';
      addToast(`Exercice ${fiscalLabel(year)} ${action} — solde : ${balance} j. HR notifié.`, 'success');
      setFormBalance('');
      await fetchEmployee();
    } catch (err) {
      setFormError(err.response?.data?.error || err.message);
    } finally {
      setFormSaving(false);
    }
  }

  function balancePlaceholder() {
    const y = parseInt(formYear, 10);
    const existing = exercises.find(ex => ex.year === y);
    return existing ? `Actuel : ${existing.balance} j` : '0 – 30';
  }

  /* ══ Render ══ */
  if (loading) {
    return (
      <div className="emp-details-page">
        <div className="emp-details-loading">
          <div className="spinner-border" role="status" style={{ color: 'var(--primary)' }} />
          <span>Chargement des données…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="emp-details-page">
        <div className="emp-details-error">
          <p>{error}</p>
          <button className="btn btn-primary" onClick={() => navigate('/admin')}>← Retour</button>
        </div>
      </div>
    );
  }

  if (!employee) return null;

  return (
    <div className="emp-details-page">
      <Toasts toasts={toasts} />

      {/* ── Header ── */}
      <header className="emp-details-header">
        <button className="emp-details-back" onClick={() => navigate('/admin')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Retour
        </button>
        <h1 className="emp-details-title">
          Gestion de l'employé
          <span className="emp-details-name-badge">{employee.firstName} {employee.lastName}</span>
        </h1>
      </header>

      <main className="emp-details-main">

        {/* ── Row 1: Personal info + Exercise management ── */}
        <div className="emp-details-grid">

          {/* Personal info */}
          <div className="section-card emp-info-card">
            <h2 className="section-title-accent emp-card-heading">Informations personnelles</h2>
            <dl className="emp-info-list">
              <div className="emp-info-row"><dt>Nom complet</dt><dd>{employee.firstName} {employee.lastName}</dd></div>
              <div className="emp-info-row"><dt>Email</dt><dd>{employee.email}</dd></div>
              {employee.matricule && <div className="emp-info-row"><dt>Matricule</dt><dd>{employee.matricule}</dd></div>}
              <div className="emp-info-row">
                <dt>Rôle</dt>
                <dd><span className="role-chip">{employee.roleLabel || ROLE_LABELS[employee.role] || employee.role}</span></dd>
              </div>
              {employee.unit?.name && (
                <div className="emp-info-row">
                  <dt>Unité</dt>
                  <dd>{employee.unit.name} <span style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>({employee.unit.type})</span></dd>
                </div>
              )}
              {employee.recrutement_date && (
                <div className="emp-info-row">
                  <dt>Date d'entrée</dt>
                  <dd>{new Date(employee.recrutement_date).toLocaleDateString('fr-FR')}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Exercise management */}
          <div className="section-card">
            <h2 className="section-title-accent emp-card-heading">
              Gérer un exercice
              <span className="emp-card-subtext">Créer ou mettre à jour le solde d'un exercice</span>
            </h2>

            <div className="manage-exercise-rules">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span>
                Conditions : année ≤ exercice courant ({fiscalLabel(maxYear)}) · solde 0–30 j ·
                un log d'audit et une notification aux responsables RH sont créés automatiquement.
              </span>
            </div>

            <form className="manage-exercise-form" onSubmit={handleSaveExercise} noValidate>
              <div className="mef-row">
                <div className="mef-field">
                  <label htmlFor="ex-year" className="mef-label">
                    Année de début d'exercice <span className="required-mark">*</span>
                  </label>
                  <input
                    id="ex-year"
                    type="number"
                    className="mef-input"
                    value={formYear}
                    min={employee.recrutement_date ? new Date(employee.recrutement_date).getFullYear() : 2000}
                    max={maxYear}
                    onChange={e => setFormYear(e.target.value)}
                    required
                  />
                  <span className="mef-hint">Exercice {fiscalLabel(parseInt(formYear, 10) || maxYear)}</span>
                </div>

                <div className="mef-field">
                  <label htmlFor="ex-balance" className="mef-label">
                    Solde (jours) <span className="required-mark">*</span>
                  </label>
                  <input
                    id="ex-balance"
                    type="number"
                    className="mef-input"
                    value={formBalance}
                    min="0"
                    max="30"
                    step="0.5"
                    placeholder={balancePlaceholder()}
                    onChange={e => setFormBalance(e.target.value)}
                    required
                  />
                  <span className="mef-hint">Entre 0 et 30 jours</span>
                </div>
              </div>

              {formError && (
                <div className="field-error" role="alert">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  {formError}
                </div>
              )}

              <button type="submit" className="btn btn-brand mef-submit" disabled={formSaving}>
                {formSaving ? (
                  <><span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />Enregistrement…</>
                ) : (
                  <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Enregistrer l'exercice</>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* ── Exercises table ── */}
        <div className="section-card">
          <h2 className="section-title-accent emp-card-heading">
            Exercices &amp; Soldes
            <span className="emp-card-subtext">{exercises.length} exercice{exercises.length !== 1 ? 's' : ''} enregistré{exercises.length !== 1 ? 's' : ''}</span>
          </h2>

          {exercises.length === 0 ? (
            <div className="empty-state">Aucun exercice trouvé pour cet employé.</div>
          ) : (
            <div className="table-responsive">
              <table className="table align-middle emp-ex-table">
                <thead>
                  <tr className="muted-note text-uppercase">
                    <th>Exercice fiscal</th><th>Solde (j)</th><th>Créé le</th><th>Dernière MAJ</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {exercises
                    .slice()
                    .sort((a, b) => b.year - a.year)
                    .map((ex, idx) => {
                      const isCurrent = ex.year === maxYear;
                      return (
                        <tr key={idx} className={isCurrent ? 'ex-row-current' : ''}>
                          <td>
                            <span className="ex-year-label">{fiscalLabel(ex.year)}</span>
                            {isCurrent && <span className="current-ex-pill">Courant</span>}
                          </td>
                          <td><span className="ex-balance-val">{Number(ex.balance).toFixed(1)}</span> <span className="muted-note" style={{ fontSize: '0.82rem' }}>j</span></td>
                          <td className="muted-note">{ex.created_at ? new Date(ex.created_at).toLocaleDateString('fr-FR') : '—'}</td>
                          <td className="muted-note">{ex.updated_at ? new Date(ex.updated_at).toLocaleDateString('fr-FR') : '—'}</td>
                          <td>
                            <button
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() => { setFormYear(String(ex.year)); setFormBalance(String(ex.balance)); }}
                            >
                              Modifier
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

        {/* ── Leave Requests ── */}
        {employee.leaveRequests && employee.leaveRequests.length > 0 && (
          <div className="section-card">
            <h2 className="section-title-accent emp-card-heading">
              Historique des demandes de congé
              <span className="emp-card-subtext">{employee.leaveRequests.length} demande{employee.leaveRequests.length !== 1 ? 's' : ''}</span>
            </h2>
            <div className="table-responsive">
              <table className="table align-middle table-sm">
                <thead>
                  <tr className="muted-note text-uppercase">
                    <th>#</th><th>Type</th><th>Début</th><th>Durée</th><th>Statut</th><th>Créé par</th>
                  </tr>
                </thead>
                <tbody>
                  {employee.leaveRequests.map((lr) => (
                    <tr key={lr.id}>
                      <td className="muted-note">#{lr.id}</td>
                      <td>{lr.leaveType}</td>
                      <td className="muted-note">{new Date(lr.startDate).toLocaleDateString('fr-FR')}</td>
                      <td>{lr.duration} j</td>
                      <td><StatusBadge status={lr.status} /></td>
                      <td className="muted-note">{lr.createdByName || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
