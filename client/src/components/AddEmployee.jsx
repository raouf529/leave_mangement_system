import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from './api';
import './AddEmployee.css';

function AddEmployee() {
  const [formData, setFormData] = useState({
    nom: '',
    nom_jeune_fille: '',
    prenom: '',
    email: '',
    matricule: '',
    fonction: '',
    role: 'employe',
    direction_id: '',
    departement_id: '',
    service_id: '',
    date_entree: '',
    can_create_for_employee: false,
    role_leave_validation: 'employe',
    is_leave_responsible: false,
  });

  const [directions, setDirections] = useState([]);
  const [departements, setDepartements] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    const fetchOrgStructure = async () => {
      try {
        const [dirRes, depRes, srvRes] = await Promise.all([
          api.get('/employe/directions'),
          api.get('/employe/departements'),
          api.get('/employe/services')
        ]);
        
        setDirections(dirRes.data || []);
        setDepartements(depRes.data || []);
        setServices(srvRes.data || []);
      } catch (err) {
        console.error('Error fetching org structure', err);
        setError('Impossible de charger la structure de l\'organisation');
      } finally {
        setLoading(false);
      }
    };
    fetchOrgStructure();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const dataToSubmit = { ...formData };
      if (!dataToSubmit.direction_id) dataToSubmit.direction_id = null;
      if (!dataToSubmit.departement_id) dataToSubmit.departement_id = null;
      if (!dataToSubmit.service_id) dataToSubmit.service_id = null;
      
      await api.post('/employe/create', dataToSubmit);
      setSuccess('Employé ajouté avec succès');
      
      // Reset form on success
      setFormData({
        nom: '', nom_jeune_fille: '', prenom: '', email: '',
        matricule: '', fonction: '', role: 'employe',
        direction_id: '', departement_id: '', service_id: '',
        date_entree: '', can_create_for_employee: false,
        role_leave_validation: 'employe', is_leave_responsible: false
      });
    } catch (err) {
      console.error('Error adding employee', err);
      setError(err.response?.data?.error || 'Erreur lors de l\'ajout de l\'employé');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="add-emp-loading">Chargement...</div>;

  return (
    <div className="add-emp-container p-4">
      <h2 className="mb-4">Ajouter un nouvel employé</h2>
      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}
      
      <form onSubmit={handleSubmit} className="add-emp-form">
        <div className="row g-3">
          <div className="col-md-6">
            <label className="form-label">Nom <span className="text-danger">*</span></label>
            <input type="text" className="form-control" name="nom" value={formData.nom} onChange={handleChange} required />
          </div>
          <div className="col-md-6">
            <label className="form-label">Prénom <span className="text-danger">*</span></label>
            <input type="text" className="form-control" name="prenom" value={formData.prenom} onChange={handleChange} required />
          </div>
          
          <div className="col-md-6">
            <label className="form-label">Email <span className="text-danger">*</span></label>
            <input type="email" className="form-control" name="email" value={formData.email} onChange={handleChange} required />
          </div>
          <div className="col-md-6">
            <label className="form-label">Matricule <span className="text-danger">*</span></label>
            <input type="number" className="form-control" name="matricule" value={formData.matricule} onChange={handleChange} required />
          </div>

          <div className="col-md-6">
            <label className="form-label">Fonction <span className="text-danger">*</span></label>
            <input type="text" className="form-control" name="fonction" value={formData.fonction} onChange={handleChange} required />
          </div>
          <div className="col-md-6">
            <label className="form-label">Date d'entrée <span className="text-danger">*</span></label>
            <input type="date" className="form-control" name="date_entree" value={formData.date_entree} onChange={handleChange} required />
          </div>

          <div className="col-md-4">
            <label className="form-label">Direction</label>
            <select className="form-select" name="direction_id" value={formData.direction_id} onChange={handleChange}>
              <option value="">Sélectionner une direction</option>
              {directions.map(d => (
                <option key={d.id} value={d.id}>{d.nom}</option>
              ))}
            </select>
          </div>
          
          <div className="col-md-4">
            <label className="form-label">Département</label>
            <select className="form-select" name="departement_id" value={formData.departement_id} onChange={handleChange}>
              <option value="">Sélectionner un département</option>
              {departements.filter(d => !formData.direction_id || d.direction_id == formData.direction_id).map(d => (
                <option key={d.id} value={d.id}>{d.nom}</option>
              ))}
            </select>
          </div>

          <div className="col-md-4">
            <label className="form-label">Service</label>
            <select className="form-select" name="service_id" value={formData.service_id} onChange={handleChange}>
              <option value="">Sélectionner un service</option>
              {services.filter(s => (!formData.departement_id || s.departement_id == formData.departement_id) && (!formData.direction_id || s.direction_id == formData.direction_id)).map(s => (
                <option key={s.id} value={s.id}>{s.nom}</option>
              ))}
            </select>
          </div>

          <div className="col-md-6">
            <label className="form-label">Rôle d'accès</label>
            <select className="form-select" name="role" value={formData.role} onChange={handleChange}>
              <option value="employe">Employé</option>
              <option value="chef_service">Chef de service</option>
              <option value="chef_departement">Chef de département</option>
              <option value="directeur">Directeur</option>
              <option value="drh">DRH</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div className="col-md-6">
            <label className="form-label">Rôle Validation (Congés)</label>
            <select className="form-select" name="role_leave_validation" value={formData.role_leave_validation} onChange={handleChange}>
              <option value="employe">Employé</option>
              <option value="chef_service">Chef de service</option>
              <option value="chef_departement">Chef de département</option>
              <option value="directeur">Directeur</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div className="col-12 mt-4 mb-2">
            <div className="form-check">
              <input className="form-check-input" type="checkbox" name="can_create_for_employee" id="can_create" checked={formData.can_create_for_employee} onChange={handleChange} />
              <label className="form-check-label" htmlFor="can_create">
                Peut créer des demandes pour d'autres employés (Chef)
              </label>
            </div>
            <div className="form-check">
              <input className="form-check-input" type="checkbox" name="is_leave_responsible" id="is_resp" checked={formData.is_leave_responsible} onChange={handleChange} />
              <label className="form-check-label" htmlFor="is_resp">
                Responsable validation finale RH
              </label>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <button type="submit" className="btn btn-primary px-4" disabled={submitting}>
            {submitting ? 'Création...' : 'Créer l\'employé'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default AddEmployee;
