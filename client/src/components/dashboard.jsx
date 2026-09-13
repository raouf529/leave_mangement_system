import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Header from './header';
import LeaveRequestModal from './LeaveRequestModal';  
// this page where employee information and can send leave request and see the status of leave request

async function getInformation() {
  const response = await axios.get('http://localhost:5000/api/profile/me', {
    withCredentials: true
  });
  return response.data;
}

async function getMyPendingSteps() {
  const response = await axios.get('http://localhost:5000/api/request/steps/me', {
    withCredentials: true
  });
  return response.data;
}
async function cancelRequest(requestId) {
  const response = await axios.patch(
    `http://localhost:5000/api/request/${requestId}/cancel`,
    {},
    { withCredentials: true }
  );
  return response.data;
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

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('fr-FR');
}

// Exercise.year is the fiscal start year. Example: 2025 means 01/07/2025 to 30/06/2026.
function getExerciseRange(exerciseLabel) {
  const startYear = parseInt(exerciseLabel, 10);
  if (Number.isNaN(startYear)) return null;
  const endYear = startYear + 1;
  return {
    startYear,
    endYear,
    from: `01/07/${startYear}`,
    to: `30/06/${endYear}`
  };
}

function isCurrentExercise(exerciseLabel) {
  const range = getExerciseRange(exerciseLabel);
  if (!range) return false;
  const today = new Date();
  const start = new Date(range.startYear, 6, 1); // July 1
  const end = new Date(range.endYear, 5, 30); // June 30
  return today >= start && today <= end;
}

function getEndDate(startDate, duration) {
  if (!startDate) return null;
  const d = new Date(startDate);
  d.setDate(d.getDate() + (Number(duration) || 0));
  return d;
}

function Dashboard() {
  const [employeeInfo, setEmployeeInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [cancelingId, setCancelingId] = useState(null);
  const navigate = useNavigate();

  async function handleCancelRequest(requestId) {
    setCancelingId(requestId);
    try {
      await cancelRequest(requestId);
      setEmployeeInfo((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          leaveRequests: prev.leaveRequests.map((request) =>
            request.id === requestId ? { ...request, status: 'cancelled' } : request
          )
        };
      });
      setError('');
    } catch (err) {
      console.error('Error cancelling request:', err);
      setError(err.response?.data?.error ?? 'Impossible d\'annuler cette demande.');
    } finally {
      setCancelingId(null);
    }
  }

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await getInformation();
        setEmployeeInfo(data);
      } catch (err) {
        console.error('Error fetching employee information:', err);
        setError("Impossible de charger vos informations.");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const activeExercises = (employeeInfo?.exercises ?? []).filter(
    (ex) => Number(ex.balance) > 0
  );
  const leaveRequests = employeeInfo?.leaveRequests ?? [];

  return (
    <div
      className="min-vh-100"
      style={{ background: 'linear-gradient(135deg, #eef2fb 0%, #f7f9fc 100%)' }}
    >
      <Header
        EmployeeName={employeeInfo ? `${employeeInfo.firstName} ${employeeInfo.lastName}` : ''}
        EmployeeRole={employeeInfo ? employeeInfo.role : ''}
      />

      <main className="container py-4 py-md-5">
        {/* Title + action */}
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-4">
          <div>
            <h1 className="h3 fw-bold mb-1">Espace Employé</h1>
            <p className="text-muted mb-0">Bienvenue dans votre espace personnel</p>
          </div>
          <button className="btn btn-primary btn-lg" onClick={() => setShowRequestModal(true)}>
              Demander un congé
          </button>
        </div>

        {error && (
          <div className="alert alert-danger py-2 small" role="alert">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center text-muted py-5">Chargement...</div>
        ) : (
          <>
            {/* Exercices */}
            <div className="bg-white shadow rounded-4 p-4 p-md-5 mb-4">
              <h2 className="h5 fw-bold mb-4">Exercices</h2>
              {activeExercises.length === 0 ? (
                <p className="text-muted mb-0">Aucun solde disponible pour le moment.</p>
              ) : (
                <div className="row g-3">
                  {activeExercises.map((exercise, index) => {
                    const range = getExerciseRange(exercise.exercise);
                    const current = isCurrentExercise(exercise.exercise);
                    return (
                      <div className="col-12 col-sm-6 col-md-4" key={index}>
                        <div
                          className={`rounded-4 p-3 h-100 ${current ? 'bg-light' : ''}`}
                          style={{
                            border: current ? '1.5px solid #0d6efd' : '1px solid #e5e9f2'
                          }}
                        >
                          <p className="fw-bold mb-1">
                            {range ? `Exercice ${range.startYear} / ${range.endYear}` : exercise.exercise}
                          </p>
                          {range && (
                            <p className="text-primary small mb-3">
                              Du {range.from} au {range.to}
                            </p>
                          )}
                          <p className="mb-2">{exercise.balance} j restants</p>
                          {current && (
                            <span className="badge rounded-pill bg-success-subtle text-success px-3 py-2">
                              Exercice en cours
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Historique des demandes */}
            <div className="bg-white shadow rounded-4 p-4 p-md-5">
              <h2 className="h5 fw-bold mb-4">Historique des demandes</h2>
              {leaveRequests.length === 0 ? (
                <p className="text-muted mb-0">Aucune demande de congé pour le moment.</p>
              ) : (
                <div className="table-responsive">
                  <table className="table align-middle">
                    <thead>
                      <tr className="text-muted small text-uppercase">
                        <th>Type</th>
                        <th>Dates</th>
                        <th>Durée</th>
                        <th>Statut</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaveRequests.map((lr) => {
                        const endDate = getEndDate(lr.startDate, lr.duration);
                        return (
                          <tr key={lr.id}>
                            <td className="fw-medium">{LEAVE_TYPE_LABELS[lr.leaveType] ?? lr.leaveType}</td>
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
                            <td>
                              <button
                                className="btn btn-outline-secondary btn-sm"
                                disabled={cancelingId === lr.id || lr.status === 'cancelled' || lr.status === 'rejected' || lr.status === 'approved'}
                                onClick={() => handleCancelRequest(lr.id)}
                              >
                                {cancelingId === lr.id ? 'Annulation...' : 'Annuler'}
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
          </>
        )}
      </main>
      {showRequestModal && (
    <LeaveRequestModal
          onClose={() => setShowRequestModal(false)}
          onSuccess={() => window.location.reload()} // simplest refresh; swap for a refetch call later
        />
      )}
    </div>
  );
}

export default Dashboard;