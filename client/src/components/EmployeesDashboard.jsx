import { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import Header from './header';
import useCurrentUser from '../hooks/useCurrentUser';

function getUnitInformation() {
  return axios.get('http://localhost:5000/api/profile/me/underemployees', {
    withCredentials: true
  });
}

function getEmployeeInformation(id) {
  return axios.get(`http://localhost:5000/api/profile/${id}`, {
    withCredentials: true
  });
}

const LEAVE_TYPE_LABELS = {
  annual: 'Congé annuel',
  exceptional: 'Congé exceptionnel',
  advance: 'Avance sur congé'
};

const STATUS_LABELS = {
  pending: 'En attente',
  approved: 'Approuvée',
  rejected: 'Refusée',
  cancelled: 'Annulée'
};

const STATUS_BADGE_CLASSES = {
  pending: 'bg-warning text-dark',
  approved: 'bg-success',
  rejected: 'bg-danger',
  cancelled: 'bg-secondary'
};

const ROLE_LABELS = {
  head: 'Chef',
  hr: 'RH',
  employee: 'Employé'
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

function EmployeesDashboard() {
  const [employees, setEmployees] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState('');
  const { role: currentRole, loading: currentUserLoading } = useCurrentUser();

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const detailRequestRef = useRef(0);
  
  useEffect(() => {
    async function fetchList() {
      try {
        const response = await getUnitInformation();
        console.log('Fetched employees:', response.data);
        setEmployees(response.data ?? []);
      } catch (err) {
        console.error('Error fetching employees:', err);
        setListError("Impossible de charger la liste des employés.");
      } finally {
        setLoadingList(false);
      }
    }

    if (currentUserLoading) {
      return;
    }

    if (currentRole === 'head' || currentRole === 'hr') {
      fetchList();
    } else {
      setLoadingList(false);
      setListError('Accès réservé aux responsables.');
    }
  }, [currentRole, currentUserLoading]);

  const filteredEmployees = useMemo(() => {
    const term = search.trim().toLowerCase();
    return employees.filter((emp) => {
      const matchesRole = roleFilter === 'all' || emp.role === roleFilter;
      if (!matchesRole) return false;
      if (!term) return true;
      const fullName = `${emp.firstName} ${emp.lastName}`.toLowerCase();
      return fullName.includes(term) || (emp.email ?? '').toLowerCase().includes(term);
    });
  }, [employees, search, roleFilter]);

  async function handleViewDetails(id) {
    const requestId = ++detailRequestRef.current;
    const clickedEmployee = employees.find((emp) => Number(emp.id) === Number(id));

    setSelectedId(id);
    setDetail(
      clickedEmployee
        ? {
            ...clickedEmployee,
            exercises: [],
            leaveRequests: []
          }
        : null
    );
    setDetailError('');
    setDetailLoading(true);

    try {
      const response = await getEmployeeInformation(id);
      if (requestId !== detailRequestRef.current) {
        return;
      }

      const fetchedEmployee = response?.data ?? null;
      if (!fetchedEmployee) {
        setDetail(clickedEmployee ?? null);
        return;
      }

      setDetail({
        ...fetchedEmployee,
        id: fetchedEmployee.id ?? fetchedEmployee.Emp_id ?? id,
        firstName: fetchedEmployee.firstName ?? fetchedEmployee.First_name ?? clickedEmployee?.firstName ?? '',
        lastName: fetchedEmployee.lastName ?? fetchedEmployee.Last_name ?? clickedEmployee?.lastName ?? '',
        email: fetchedEmployee.email ?? '',
        recruitmentDate: fetchedEmployee.recrutement_date ?? fetchedEmployee.recruitment_date ?? null,
        exercises: Array.isArray(fetchedEmployee.exercises)
          ? fetchedEmployee.exercises.map((ex) => ({
              exercise: ex.exercise ?? ex.year,
              balance: ex.balance ?? ex.remainingDays ?? 0
            }))
          : [],
        leaveRequests: Array.isArray(fetchedEmployee.leaveRequests)
          ? fetchedEmployee.leaveRequests.map((request) => ({
              ...request,
              id: request.id ?? request.request_id,
              startDate: request.startDate ?? request.start_date,
              duration: request.duration ?? request.duration_days ?? 0,
              status: request.status ?? request.request_status,
              leaveType: request.leaveType ?? request.leave_type ?? request.type,
              type: request.type ?? request.leaveType ?? request.leave_type,
              allocations: Array.isArray(request.allocations) ? request.allocations : []
            }))
          : []
      });
    } catch (err) {
      console.error('Error fetching employee details:', err);
      if (requestId !== detailRequestRef.current) {
        return;
      }
      setDetail(clickedEmployee ?? null);
      setDetailError("Impossible de charger les informations de cet employé.");
    } finally {
      if (requestId === detailRequestRef.current) {
        setDetailLoading(false);
      }
    }
  }

  function closeDetails() {
    setSelectedId(null);
    setDetail(null);
    setDetailError('');
  }

  const normalizedDetail = detail
    ? {
        ...detail,
        exercises: Array.isArray(detail.exercises) ? detail.exercises : [],
        leaveRequests: Array.isArray(detail.leaveRequests)
          ? detail.leaveRequests.map((request) => ({
              ...request,
              id: request.id ?? request.request_id,
              startDate: request.startDate ?? request.start_date,
              duration: request.duration ?? request.duration_days ?? 0,
              status: request.status ?? request.request_status,
              leaveType: request.leaveType ?? request.leave_type ?? request.type,
              type: request.type ?? request.leaveType ?? request.leave_type,
              allocations: Array.isArray(request.allocations) ? request.allocations : [],
              currentStep: request.currentStep ?? null,
              rejectionReason: request.rejectionReason ?? request.rejection_reason ?? null
            }))
          : []
      }
    : null;

  const activeExercises = (normalizedDetail?.exercises ?? []).filter((ex) => Number(ex.balance) > 0);
  const leaveRequests = normalizedDetail?.leaveRequests ?? [];

  return (
    <div
      className="min-vh-100"
      style={{ background: 'linear-gradient(135deg, #eef2fb 0%, #f7f9fc 100%)' }}
    >
      <Header />

      <main className="container py-4 py-md-5">
        <div className="mb-4">
          <h1 className="h3 fw-bold mb-1">Espace Superviseur</h1>
          <p className="text-muted mb-0">Suivi des congés de votre équipe</p>
        </div>

        {/* Liste des employés */}
        <div className="bg-white shadow rounded-4 p-4 p-md-5 mb-4">
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-4">
            <h2 className="h5 fw-bold mb-0">Employés</h2>
            <div className="d-flex flex-wrap gap-2">
              <input
                type="text"
                className="form-control"
                placeholder="Rechercher par nom ou email"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ minWidth: '220px' }}
              />
              <select
                className="form-select"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                style={{ minWidth: '160px' }}
              >
                <option value="all">Tous les rôles</option>
                <option value="employee">Employé</option>
                <option value="head">Chef</option>
                <option value="hr">RH</option>
              </select>
            </div>
          </div>

          {listError && (
            <div className="alert alert-danger py-2 small" role="alert">
              {listError}
            </div>
          )}

          {loadingList ? (
            <div className="text-center text-muted py-5">Chargement...</div>
          ) : filteredEmployees.length === 0 ? (
            <p className="text-muted mb-0">Aucun employé ne correspond à cette recherche.</p>
          ) : (
            <div className="table-responsive">
              <table className="table align-middle">
                <thead>
                  <tr className="text-muted small text-uppercase">
                    <th>Nom</th>
                    <th>Email</th>
                    <th>Rôle</th>
                    <th>Unité</th>
                    <th>Type d'unité</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((emp) => (
                    <tr key={emp.id}>
                      <td className="fw-medium">{emp.firstName} {emp.lastName}</td>
                      <td>{emp.email}</td>
                      <td>{ROLE_LABELS[emp.role] ?? emp.role}</td>
                      <td>{emp.unit?.name ?? '—'}</td>
                      <td>{emp.unit?.type ?? '—'}</td>
                      <td className="text-end">
                        <button
                          className="btn btn-outline-primary btn-sm"
                          onClick={() => handleViewDetails(emp.id)}
                        >
                          Voir détails
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Détails employé sélectionné */}
        {selectedId && (
          <div className="bg-white shadow rounded-4 p-4 p-md-5">
            <div className="d-flex align-items-center justify-content-between mb-4">
              <h2 className="h5 fw-bold mb-0">
                {detail ? `${detail.firstName} ${detail.lastName}` : 'Détails de l\'employé'}
              </h2>
              <button className="btn btn-light btn-sm" onClick={closeDetails}>
                Fermer
              </button>
            </div>

            {detailError && (
              <div className="alert alert-danger py-2 small" role="alert">
                {detailError}
              </div>
            )}

            {detailLoading ? (
              <div className="text-center text-muted py-5">Chargement...</div>
            ) : detail ? (
              <>
                <div className="row g-3 mb-4">
                  <div className="col-12 col-sm-6 col-md-4">
                    <p className="text-muted small mb-1">Email</p>
                    <p className="fw-medium mb-0">{detail.email}</p>
                  </div>
                  <div className="col-12 col-sm-6 col-md-4">
                    <p className="text-muted small mb-1">Unité</p>
                    <p className="fw-medium mb-0">{detail.unit?.name ?? '—'}</p>
                  </div>
                  <div className="col-12 col-sm-6 col-md-4">
                    <p className="text-muted small mb-1">Type d'unité</p>
                    <p className="fw-medium mb-0">{detail.unit?.type ?? '—'}</p>
                  </div>
                  <div className="col-12 col-sm-6 col-md-4">
                    <p className="text-muted small mb-1">Date de recrutement</p>
                    <p className="fw-medium mb-0">{formatDate(detail.recrutement_date ?? detail.recruitmentDate)}</p>
                  </div>
                </div>

                <h3 className="h6 fw-bold mb-3">Exercices</h3>
                {activeExercises.length === 0 ? (
                  <p className="text-muted">Aucun solde disponible.</p>
                ) : (
                  <div className="row g-3 mb-4">
                    {activeExercises.map((ex, index) => (
                      <div className="col-12 col-sm-6 col-md-4" key={index}>
                        <div className="border rounded-4 p-3 h-100">
                          <p className="text-muted small mb-1">Exercice</p>
                          <p className="fw-medium mb-3">{ex.exercise}</p>
                          <p className="text-muted small mb-1">Solde</p>
                          <p className="h5 fw-bold mb-0" style={{ color: '#0d6efd' }}>
                            {ex.balance} j
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <h3 className="h6 fw-bold mb-3">Historique des demandes</h3>
                {leaveRequests.length === 0 ? (
                  <p className="text-muted mb-0">Aucune demande de congé.</p>
                ) : (
                  <div className="table-responsive">
                    <table className="table align-middle">
                      <thead>
                        <tr className="text-muted small text-uppercase">
                          <th>Type</th>
                          <th>Dates</th>
                          <th>Durée</th>
                          <th>Statut</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaveRequests.map((lr) => {
                          const leaveTypeKey = lr.leaveType ?? lr.type ?? lr.leave_type;
                          const endDate = getEndDate(lr.startDate, lr.duration);
                          return (
                            <tr key={lr.id ?? `${lr.startDate}-${lr.duration}`}>
                              <td>{LEAVE_TYPE_LABELS[leaveTypeKey] ?? leaveTypeKey}</td>
                              <td>
                                {formatDate(lr.startDate)}
                                {endDate ? ` → ${formatDate(endDate)}` : ''}
                              </td>
                              <td>{lr.duration} j</td>
                              <td>
                                <span
                                  className={`badge rounded-pill ${STATUS_BADGE_CLASSES[lr.status] ?? 'bg-secondary'}`}
                                >
                                  {STATUS_LABELS[lr.status] ?? lr.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}

export default EmployeesDashboard;