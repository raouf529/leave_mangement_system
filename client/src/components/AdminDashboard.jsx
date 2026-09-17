import { useState, useEffect } from 'react';
import Header from './header';
import api from './api';
import useCurrentUser from '../hooks/useCurrentUser';

export default function AdminDashboard() {
  const { role, roleLabel, fullName } = useCurrentUser();
  const [activeTab, setActiveTab] = useState('exercises');

  // Employees list for easy selection
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  // Global Alert State
  const [alert, setAlert] = useState(null); // { type: 'success' | 'danger', message: '' }

  // Exercise Form States
  const [globalYear, setGlobalYear] = useState(new Date().getFullYear());
  const [newEmpId, setNewEmpId] = useState('');
  const [newEmpYear, setNewEmpYear] = useState(new Date().getFullYear());
  const [balEmpId, setBalEmpId] = useState('');
  const [balYear, setBalYear] = useState(new Date().getFullYear());
  const [balAmount, setBalAmount] = useState('');
  const [submittingEx, setSubmittingEx] = useState(null); // 'global' | 'newEmp' | 'balance'

  // Leave Request Form State
  const [reqIdInput, setReqIdInput] = useState('');
  const [loadingReq, setLoadingReq] = useState(false);
  const [leaveReqForm, setLeaveReqForm] = useState({
    requestId: '',
    Emp_id: '',
    exercise: new Date().getFullYear(),
    leave_type: 'annual',
    start_date: '',
    duration: 1,
    reason_type: '',
    justification: '',
    url_justification: '',
    request_status: 'pending'
  });

  // Request Step Form State
  const [stepIdInput, setStepIdInput] = useState('');
  const [loadingStep, setLoadingStep] = useState(false);
  const [stepForm, setStepForm] = useState({
    stepId: '',
    request_id: '',
    step_order: 1,
    target_id: '',
    decision: 'pending',
    comment: '',
    decided_at: ''
  });

  // Fetch employees list for select dropdowns
  useEffect(() => {
    let isMounted = true;
    setLoadingEmployees(true);
    api.get('/profile/all')
      .then((res) => {
        if (isMounted) {
          setEmployees(res.data || []);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch employees list:', err);
      })
      .finally(() => {
        if (isMounted) setLoadingEmployees(false);
      });
    return () => { isMounted = false; };
  }, []);

  const showAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => {
      setAlert(null);
    }, 6000);
  };

  // --- Handlers for Exercises ---
  const handleCreateGlobalExercise = async (e) => {
    e.preventDefault();
    setSubmittingEx('global');
    try {
      await api.post('/admin/create-exercise', { year: Number(globalYear) });
      showAlert('success', `Exercices créés avec succès pour l'année ${globalYear} pour tous les employés.`);
    } catch (err) {
      showAlert('danger', err.response?.data?.error || 'Erreur lors de la création de l\'exercice global.');
    } finally {
      setSubmittingEx(null);
    }
  };

  const handleCreateNewEmpExercise = async (e) => {
    e.preventDefault();
    if (!newEmpId) return showAlert('danger', 'Veuillez sélectionner ou saisir un ID employé.');
    setSubmittingEx('newEmp');
    try {
      await api.post('/admin/create-exercise-new-employee', {
        empId: Number(newEmpId),
        year: Number(newEmpYear)
      });
      showAlert('success', `Exercice ${newEmpYear} créé pour l'employé #${newEmpId}.`);
    } catch (err) {
      showAlert('danger', err.response?.data?.error || 'Erreur lors de la création de l\'exercice pour le nouvel employé.');
    } finally {
      setSubmittingEx(null);
    }
  };

  const handleUpdateBalance = async (e) => {
    e.preventDefault();
    if (!balEmpId || balAmount === '') return showAlert('danger', 'Remplissez l\'ID employé et le solde.');
    setSubmittingEx('balance');
    try {
      const res = await api.post('/admin/update-exercise-balance', {
        empId: Number(balEmpId),
        year: Number(balYear),
        balance: Number(balAmount)
      });
      showAlert('success', `Solde mis à jour à ${res.data?.balance ?? balAmount} jours pour l'employé #${balEmpId} (${balYear}).`);
    } catch (err) {
      showAlert('danger', err.response?.data?.error || 'Erreur lors de la mise à jour du solde.');
    } finally {
      setSubmittingEx(null);
    }
  };

  // --- Handlers for Leave Request ---
  const handleFetchLeaveRequest = async (e) => {
    e.preventDefault();
    if (!reqIdInput) return;
    setLoadingReq(true);
    try {
      const res = await api.get(`/request/${reqIdInput}`);
      const data = res.data;
      if (data) {
        setLeaveReqForm({
          requestId: data.request_id || reqIdInput,
          Emp_id: data.Emp_id || '',
          exercise: data.exercise || new Date().getFullYear(),
          leave_type: data.leave_type || 'annual',
          start_date: data.start_date ? data.start_date.substring(0, 10) : '',
          duration: data.duration || 1,
          reason_type: data.reason_type || '',
          justification: data.justification || '',
          url_justification: data.url_justification || '',
          request_status: data.request_status || 'pending'
        });
        showAlert('success', `Demande #${reqIdInput} chargée avec succès.`);
      }
    } catch (err) {
      showAlert('danger', err.response?.data?.message || 'Demande introuvable ou erreur de chargement.');
    } finally {
      setLoadingReq(false);
    }
  };

  const handleUpdateLeaveRequest = async (e) => {
    e.preventDefault();
    if (!leaveReqForm.requestId) {
      return showAlert('danger', 'Veuillez d\'abord charger ou saisir un ID de demande.');
    }
    setLoadingReq(true);
    try {
      const res = await api.post('/admin/update-leave-request', {
        requestId: Number(leaveReqForm.requestId),
        Emp_id: Number(leaveReqForm.Emp_id),
        exercise: Number(leaveReqForm.exercise),
        leave_type: leaveReqForm.leave_type,
        start_date: leaveReqForm.start_date || null,
        duration: Number(leaveReqForm.duration),
        reason_type: leaveReqForm.reason_type || null,
        justification: leaveReqForm.justification || null,
        url_justification: leaveReqForm.url_justification || null,
        request_status: leaveReqForm.request_status
      });
      showAlert('success', `Demande de congé #${leaveReqForm.requestId} mise à jour avec succès!`);
      if (res.data) {
        setLeaveReqForm((prev) => ({ ...prev, ...res.data }));
      }
    } catch (err) {
      showAlert('danger', err.response?.data?.error || 'Erreur lors de la mise à jour de la demande de congé.');
    } finally {
      setLoadingReq(false);
    }
  };

  // --- Handlers for Request Step ---
  const handleUpdateStep = async (e) => {
    e.preventDefault();
    if (!stepForm.stepId) {
      return showAlert('danger', 'Veuillez spécifier un ID d\'étape (step_id).');
    }
    setLoadingStep(true);
    try {
      const payload = {
        stepId: Number(stepForm.stepId),
        request_id: Number(stepForm.request_id),
        step_order: Number(stepForm.step_order),
        target_id: Number(stepForm.target_id),
        decision: stepForm.decision,
        comment: stepForm.comment || null,
        decided_at: stepForm.decided_at || null
      };

      const res = await api.post('/admin/update-request-step', payload);
      showAlert('success', `Étape #${stepForm.stepId} mise à jour avec succès!`);
      if (res.data) {
        setStepForm((prev) => ({ ...prev, ...res.data }));
      }
    } catch (err) {
      showAlert('danger', err.response?.data?.error || 'Erreur lors de la mise à jour de l\'étape.');
    } finally {
      setLoadingStep(false);
    }
  };

  return (
    <div className="admin-page bg-light min-vh-100 pb-5">
      <Header EmployeeName={fullName} EmployeeRole={role} EmployeeRoleLabel={roleLabel} />

      <style>{`
        .admin-hero {
          background: linear-gradient(135deg, #102A43 0%, #1F5673 100%);
          color: white;
          padding: 2.5rem 0;
          margin-bottom: 2rem;
          border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        .admin-badge {
          background: rgba(255, 255, 255, 0.15);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #E0F2FE;
          font-size: 0.82rem;
          font-weight: 600;
          padding: 0.35rem 0.85rem;
          border-radius: 50px;
        }
        .nav-pills-custom .nav-link {
          color: #486581;
          font-weight: 600;
          padding: 0.75rem 1.25rem;
          border-radius: 12px;
          transition: all 0.2s ease;
          background: #FFFFFF;
          border: 1px solid #E4E8ED;
        }
        .nav-pills-custom .nav-link.active {
          background: #1F5673;
          color: #FFFFFF;
          border-color: #1F5673;
          box-shadow: 0 4px 12px rgba(31, 86, 115, 0.25);
        }
        .card-custom {
          border: 1px solid #E4E8ED;
          border-radius: 16px;
          background: #FFFFFF;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.03);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .card-custom-header {
          background: #F8FAFC;
          border-bottom: 1px solid #E4E8ED;
          border-radius: 16px 16px 0 0;
          padding: 1.25rem 1.5rem;
        }
        .form-control:focus, .form-select:focus {
          border-color: #1F5673;
          box-shadow: 0 0 0 0.25rem rgba(31, 86, 115, 0.15);
        }
        .btn-primary-custom {
          background: #1F5673;
          border-color: #1F5673;
          color: white;
          font-weight: 600;
          border-radius: 10px;
          padding: 0.6rem 1.2rem;
        }
        .btn-primary-custom:hover {
          background: #164057;
          border-color: #164057;
          color: white;
        }
      `}</style>

      {/* Hero Header */}
      <div className="admin-hero shadow-sm">
        <div className="container">
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
            <div>
              <span className="admin-badge d-inline-block mb-2">⚙️ Panneau d'Administration HR</span>
              <h1 className="h3 fw-bold mb-1 text-white">Gestion Système des Congés</h1>
              <p className="mb-0 text-white-50 small">
                Gérez les exercices annuels, ajustez les soldes de congés et modifiez directement les demandes et étapes.
              </p>
            </div>
            <div className="d-flex align-items-center gap-2">
              <span className="badge bg-success bg-opacity-25 text-success border border-success border-opacity-25 px-3 py-2 rounded-pill">
                ● Connecté comme HR / Admin
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="container">
        {/* Toast Alert */}
        {alert && (
          <div className={`alert alert-${alert.type} alert-dismissible fade show shadow-sm border-0 mb-4`} role="alert">
            <div className="d-flex align-items-center gap-2">
              <span className="fs-5">{alert.type === 'success' ? '✅' : '⚠️'}</span>
              <div>{alert.message}</div>
            </div>
            <button type="button" className="btn-close" onClick={() => setAlert(null)} aria-label="Close"></button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="d-flex align-items-center gap-2 nav-pills-custom mb-4 overflow-auto pb-2">
          <button
            className={`nav-link ${activeTab === 'exercises' ? 'active' : ''}`}
            onClick={() => setActiveTab('exercises')}
          >
            🏋️ Exercices & Soldes
          </button>
          <button
            className={`nav-link ${activeTab === 'requests' ? 'active' : ''}`}
            onClick={() => setActiveTab('requests')}
          >
            📋 Demandes de Congé
          </button>
          <button
            className={`nav-link ${activeTab === 'steps' ? 'active' : ''}`}
            onClick={() => setActiveTab('steps')}
          >
            🔄 Étapes de Validation
          </button>
        </div>

        {/* TAB 1: EXERCISES & BALANCES */}
        {activeTab === 'exercises' && (
          <div className="row g-4">
            {/* 1. Global Exercise Creation */}
            <div className="col-lg-4 col-md-6">
              <div className="card card-custom h-100">
                <div className="card-custom-header">
                  <h5 className="fw-bold mb-1 text-dark fs-6">1. Nouvel Exercice Global</h5>
                  <p className="text-muted small mb-0">Initialise l'exercice pour tous les employés.</p>
                </div>
                <div className="card-body p-4 d-flex flex-column justify-content-between">
                  <form onSubmit={handleCreateGlobalExercise}>
                    <div className="mb-3">
                      <label className="form-label fw-semibold text-secondary small">Année de l'exercice</label>
                      <input
                        type="number"
                        className="form-control"
                        value={globalYear}
                        onChange={(e) => setGlobalYear(e.target.value)}
                        required
                        min="2020"
                        max="2100"
                      />
                    </div>
                    <button
                      type="submit"
                      className="btn btn-primary-custom w-100 mt-2"
                      disabled={submittingEx === 'global'}
                    >
                      {submittingEx === 'global' ? 'Création en cours...' : '⚡ Créer pour tous'}
                    </button>
                  </form>
                </div>
              </div>
            </div>

            {/* 2. New Employee Exercise */}
            <div className="col-lg-4 col-md-6">
              <div className="card card-custom h-100">
                <div className="card-custom-header">
                  <h5 className="fw-bold mb-1 text-dark fs-6">2. Exercice Nouvel Employé</h5>
                  <p className="text-muted small mb-0">Initialise l'exercice manuellement pour une recrue.</p>
                </div>
                <div className="card-body p-4 d-flex flex-column justify-content-between">
                  <form onSubmit={handleCreateNewEmpExercise}>
                    <div className="mb-3">
                      <label className="form-label fw-semibold text-secondary small">Employé</label>
                      <select
                        className="form-select mb-2"
                        value={newEmpId}
                        onChange={(e) => setNewEmpId(e.target.value)}
                      >
                        <option value="">-- Choisir un employé --</option>
                        {employees.map((emp) => (
                          <option key={emp.id} value={emp.id}>
                            #{emp.id} - {emp.prenom} {emp.nom} ({emp.role})
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        className="form-control"
                        placeholder="Saisir ID Manuellement..."
                        value={newEmpId}
                        onChange={(e) => setNewEmpId(e.target.value)}
                        required
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-semibold text-secondary small">Année</label>
                      <input
                        type="number"
                        className="form-control"
                        value={newEmpYear}
                        onChange={(e) => setNewEmpYear(e.target.value)}
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      className="btn btn-primary-custom w-100"
                      disabled={submittingEx === 'newEmp'}
                    >
                      {submittingEx === 'newEmp' ? 'Création...' : '👤 Initialiser Exercice'}
                    </button>
                  </form>
                </div>
              </div>
            </div>

            {/* 3. Update Balance */}
            <div className="col-lg-4 col-md-12">
              <div className="card card-custom h-100">
                <div className="card-custom-header">
                  <h5 className="fw-bold mb-1 text-dark fs-6">3. Ajuster le Solde de Congé</h5>
                  <p className="text-muted small mb-0">Modifie directement le solde disponible (jours).</p>
                </div>
                <div className="card-body p-4">
                  <form onSubmit={handleUpdateBalance}>
                    <div className="mb-3">
                      <label className="form-label fw-semibold text-secondary small">Employé</label>
                      <select
                        className="form-select mb-2"
                        value={balEmpId}
                        onChange={(e) => setBalEmpId(e.target.value)}
                      >
                        <option value="">-- Choisir un employé --</option>
                        {employees.map((emp) => (
                          <option key={emp.id} value={emp.id}>
                            #{emp.id} - {emp.prenom} {emp.nom}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        className="form-control"
                        placeholder="Saisir ID Manuellement..."
                        value={balEmpId}
                        onChange={(e) => setBalEmpId(e.target.value)}
                        required
                      />
                    </div>
                    <div className="row g-2 mb-3">
                      <div className="col-6">
                        <label className="form-label fw-semibold text-secondary small">Année</label>
                        <input
                          type="number"
                          className="form-control"
                          value={balYear}
                          onChange={(e) => setBalYear(e.target.value)}
                          required
                        />
                      </div>
                      <div className="col-6">
                        <label className="form-label fw-semibold text-secondary small">Nouveau Solde</label>
                        <input
                          type="number"
                          step="0.5"
                          className="form-control"
                          placeholder="Ex: 30"
                          value={balAmount}
                          onChange={(e) => setBalAmount(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="btn btn-primary-custom w-100"
                      disabled={submittingEx === 'balance'}
                    >
                      {submittingEx === 'balance' ? 'Mise à jour...' : '✏️ Mettre à jour le solde'}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: LEAVE REQUEST MANAGEMENT */}
        {activeTab === 'requests' && (
          <div className="card card-custom mb-4">
            <div className="card-custom-header d-flex align-items-center justify-content-between flex-wrap gap-2">
              <div>
                <h5 className="fw-bold mb-1 text-dark fs-6">Modifier une Demande de Congé</h5>
                <p className="text-muted small mb-0">Mettez à jour le statut, le type de congé, les dates ou justificatifs.</p>
              </div>
              <form onSubmit={handleFetchLeaveRequest} className="d-flex align-items-center gap-2">
                <input
                  type="number"
                  className="form-control form-control-sm"
                  placeholder="ID de demande..."
                  value={reqIdInput}
                  onChange={(e) => setReqIdInput(e.target.value)}
                  style={{ width: '160px' }}
                />
                <button type="submit" className="btn btn-sm btn-outline-primary fw-semibold" disabled={loadingReq}>
                  {loadingReq ? 'Chargement...' : '🔍 Charger'}
                </button>
              </form>
            </div>
            <div className="card-body p-4">
              <form onSubmit={handleUpdateLeaveRequest}>
                <div className="row g-3">
                  <div className="col-md-3">
                    <label className="form-label fw-semibold text-secondary small">Request ID *</label>
                    <input
                      type="number"
                      className="form-control"
                      value={leaveReqForm.requestId}
                      onChange={(e) => setLeaveReqForm({ ...leaveReqForm, requestId: e.target.value })}
                      required
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label fw-semibold text-secondary small">ID Employé (Emp_id) *</label>
                    <input
                      type="number"
                      className="form-control"
                      value={leaveReqForm.Emp_id}
                      onChange={(e) => setLeaveReqForm({ ...leaveReqForm, Emp_id: e.target.value })}
                      required
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label fw-semibold text-secondary small">Exercice (Année) *</label>
                    <input
                      type="number"
                      className="form-control"
                      value={leaveReqForm.exercise}
                      onChange={(e) => setLeaveReqForm({ ...leaveReqForm, exercise: e.target.value })}
                      required
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label fw-semibold text-secondary small">Statut de la demande *</label>
                    <select
                      className="form-select fw-semibold text-uppercase fs-7"
                      value={leaveReqForm.request_status}
                      onChange={(e) => setLeaveReqForm({ ...leaveReqForm, request_status: e.target.value })}
                    >
                      <option value="pending">🟡 Pending (En attente)</option>
                      <option value="approved">🟢 Approved (Approuvé)</option>
                      <option value="rejected">🔴 Rejected (Rejeté)</option>
                      <option value="cancelled">⚪ Cancelled (Annulé)</option>
                      <option value="time out">⏰ Time Out (Expiré)</option>
                    </select>
                  </div>

                  <div className="col-md-4">
                    <label className="form-label fw-semibold text-secondary small">Type de congé *</label>
                    <select
                      className="form-select"
                      value={leaveReqForm.leave_type}
                      onChange={(e) => setLeaveReqForm({ ...leaveReqForm, leave_type: e.target.value })}
                    >
                      <option value="annual">Congé Annuel</option>
                      <option value="exceptional">Congé Exceptionnel</option>
                      <option value="advance">Avance sur Congé</option>
                      <option value="recovery">Récupération</option>
                    </select>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-semibold text-secondary small">Date de début</label>
                    <input
                      type="date"
                      className="form-control"
                      value={leaveReqForm.start_date}
                      onChange={(e) => setLeaveReqForm({ ...leaveReqForm, start_date: e.target.value })}
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-semibold text-secondary small">Durée (Jours) *</label>
                    <input
                      type="number"
                      step="0.5"
                      className="form-control"
                      value={leaveReqForm.duration}
                      onChange={(e) => setLeaveReqForm({ ...leaveReqForm, duration: e.target.value })}
                      required
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label fw-semibold text-secondary small">Motif / Type de raison</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Ex: Raison médicale, évènement familial..."
                      value={leaveReqForm.reason_type}
                      onChange={(e) => setLeaveReqForm({ ...leaveReqForm, reason_type: e.target.value })}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-semibold text-secondary small">URL du justificatif</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Chemin du document..."
                      value={leaveReqForm.url_justification}
                      onChange={(e) => setLeaveReqForm({ ...leaveReqForm, url_justification: e.target.value })}
                    />
                  </div>

                  <div className="col-12">
                    <label className="form-label fw-semibold text-secondary small">Justification détaillée</label>
                    <textarea
                      rows="2"
                      className="form-control"
                      placeholder="Explications complémentaires..."
                      value={leaveReqForm.justification}
                      onChange={(e) => setLeaveReqForm({ ...leaveReqForm, justification: e.target.value })}
                    ></textarea>
                  </div>
                </div>

                <div className="mt-4 text-end">
                  <button type="submit" className="btn btn-primary-custom px-4" disabled={loadingReq}>
                    {loadingReq ? 'Sauvegarde...' : '💾 Enregistrer la Demande'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* TAB 3: REQUEST STEPS MANAGEMENT */}
        {activeTab === 'steps' && (
          <div className="card card-custom mb-4">
            <div className="card-custom-header d-flex align-items-center justify-content-between flex-wrap gap-2">
              <div>
                <h5 className="fw-bold mb-1 text-dark fs-6">Modifier une Étape de Validation (RequestStep)</h5>
                <p className="text-muted small mb-0">Ajustez l'ordre de l'étape, le responsable assigné, la décision ou la date.</p>
              </div>
            </div>
            <div className="card-body p-4">
              <form onSubmit={handleUpdateStep}>
                <div className="row g-3">
                  <div className="col-md-4">
                    <label className="form-label fw-semibold text-secondary small">ID de l'Étape (step_id) *</label>
                    <input
                      type="number"
                      className="form-control"
                      placeholder="Ex: 1"
                      value={stepForm.stepId}
                      onChange={(e) => setStepForm({ ...stepForm, stepId: e.target.value })}
                      required
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-semibold text-secondary small">ID Demande (request_id) *</label>
                    <input
                      type="number"
                      className="form-control"
                      placeholder="Ex: 10"
                      value={stepForm.request_id}
                      onChange={(e) => setStepForm({ ...stepForm, request_id: e.target.value })}
                      required
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-semibold text-secondary small">Ordre de l'étape (step_order) *</label>
                    <input
                      type="number"
                      className="form-control"
                      value={stepForm.step_order}
                      onChange={(e) => setStepForm({ ...stepForm, step_order: e.target.value })}
                      required
                    />
                  </div>

                  <div className="col-md-4">
                    <label className="form-label fw-semibold text-secondary small">Responsable Cible (target_id) *</label>
                    <select
                      className="form-select mb-1"
                      value={stepForm.target_id}
                      onChange={(e) => setStepForm({ ...stepForm, target_id: e.target.value })}
                    >
                      <option value="">-- Sélectionner un employé --</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          #{emp.id} - {emp.prenom} {emp.nom} ({emp.role})
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      className="form-control"
                      placeholder="ID Cible..."
                      value={stepForm.target_id}
                      onChange={(e) => setStepForm({ ...stepForm, target_id: e.target.value })}
                      required
                    />
                  </div>

                  <div className="col-md-4">
                    <label className="form-label fw-semibold text-secondary small">Décision de l'étape</label>
                    <select
                      className="form-select fw-semibold"
                      value={stepForm.decision || ''}
                      onChange={(e) => setStepForm({ ...stepForm, decision: e.target.value })}
                    >
                      <option value="">En attente (Null / Pending)</option>
                      <option value="approved">Approuvé (approved)</option>
                      <option value="rejected">Rejeté (rejected)</option>
                    </select>
                  </div>

                  <div className="col-md-4">
                    <label className="form-label fw-semibold text-secondary small">Date de Décision (decided_at)</label>
                    <input
                      type="datetime-local"
                      className="form-control"
                      value={stepForm.decided_at ? new Date(stepForm.decided_at).toISOString().slice(0, 16) : ''}
                      onChange={(e) => setStepForm({ ...stepForm, decided_at: e.target.value })}
                    />
                  </div>

                  <div className="col-12">
                    <label className="form-label fw-semibold text-secondary small">Commentaire de validation</label>
                    <textarea
                      rows="2"
                      className="form-control"
                      placeholder="Remarques ou motifs de validation/refus..."
                      value={stepForm.comment || ''}
                      onChange={(e) => setStepForm({ ...stepForm, comment: e.target.value })}
                    ></textarea>
                  </div>
                </div>

                <div className="mt-4 text-end">
                  <button type="submit" className="btn btn-primary-custom px-4" disabled={loadingStep}>
                    {loadingStep ? 'Sauvegarde...' : '💾 Mettre à Jour l\'Étape'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
