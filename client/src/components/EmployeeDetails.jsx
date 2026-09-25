import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from './api';
import AdminHeader from './AdminDashboard'; // We can use the generic AdminHeader or custom one, wait I'll write an inline one or simple UI.

export default function EmployeeDetails() {
  const { employeeId } = useParams();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchEmployee() {
      try {
        const res = await api.get(`/profile/${employeeId}`);
        setEmployee(res.data);
      } catch (err) {
        setError(err.response?.data?.error || err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchEmployee();
  }, [employeeId]);

  if (loading) {
    return <div className="p-5 text-center">Chargement des détails de l'employé...</div>;
  }

  if (error) {
    return (
      <div className="p-5 text-center">
        <div className="alert alert-danger">{error}</div>
        <button className="btn btn-primary mt-3" onClick={() => navigate('/admin')}>Retour</button>
      </div>
    );
  }

  if (!employee) {
    return <div className="p-5 text-center">Employé non trouvé.</div>;
  }

  return (
    <div className="admin-dashboard">
      <header className="admin-header py-3 px-4 shadow-sm mb-4 d-flex justify-content-between align-items-center">
        <h1 className="h4 mb-0">Détails de l'employé</h1>
        <button className="btn btn-outline-secondary" onClick={() => navigate('/admin')}>
          Retour à l'administration
        </button>
      </header>

      <main className="container pb-5">
        <div className="row g-4">
          {/* Personal Info */}
          <div className="col-12 col-md-4">
            <div className="card shadow-sm h-100">
              <div className="card-body">
                <h5 className="card-title text-primary mb-4">Informations Personnelles</h5>
                <p><strong>Nom :</strong> {employee.lastName} {employee.firstName}</p>
                <p><strong>Email :</strong> {employee.email}</p>
                <p><strong>Matricule :</strong> {employee.matricule}</p>
                <p><strong>Rôle :</strong> <span className="badge bg-secondary">{employee.roleLabel || employee.role}</span></p>
                <p><strong>Unité :</strong> {employee.unit?.name || '—'} ({employee.unit?.type || 'N/A'})</p>
                <p><strong>Date d'entrée :</strong> {new Date(employee.recrutement_date).toLocaleDateString()}</p>
              </div>
            </div>
          </div>

          {/* Exercises */}
          <div className="col-12 col-md-8">
            <div className="card shadow-sm h-100">
              <div className="card-body">
                <h5 className="card-title text-primary mb-4">Exercices & Soldes</h5>
                {employee.exercises && employee.exercises.length > 0 ? (
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Année d'exercice</th>
                        <th>Solde (Jours)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employee.exercises.map((ex, idx) => (
                        <tr key={idx}>
                          <td>{ex.exercise}</td>
                          <td><strong>{ex.balance}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-muted">Aucun exercice trouvé.</p>
                )}
              </div>
            </div>
          </div>

          {/* Leave Requests */}
          <div className="col-12">
            <div className="card shadow-sm">
              <div className="card-body">
                <h5 className="card-title text-primary mb-4">Historique des demandes de congé</h5>
                {employee.leaveRequests && employee.leaveRequests.length > 0 ? (
                  <div className="table-responsive">
                    <table className="table table-hover align-middle">
                      <thead className="table-light">
                        <tr>
                          <th>ID</th>
                          <th>Type</th>
                          <th>Date de début</th>
                          <th>Durée</th>
                          <th>Statut</th>
                          <th>Créé par</th>
                        </tr>
                      </thead>
                      <tbody>
                        {employee.leaveRequests.map((lr) => (
                          <tr key={lr.id}>
                            <td>#{lr.id}</td>
                            <td>{lr.leaveType}</td>
                            <td>{new Date(lr.startDate).toLocaleDateString()}</td>
                            <td>{lr.duration} jours</td>
                            <td>
                              <span className={`badge bg-${lr.status === 'approved' ? 'success' : lr.status === 'rejected' ? 'danger' : 'warning'}`}>
                                {lr.status}
                              </span>
                            </td>
                            <td>{lr.createdByName || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-muted">Aucune demande de congé.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}