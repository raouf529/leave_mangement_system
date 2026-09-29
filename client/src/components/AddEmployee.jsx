import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from './api';
import Header from './header';
import './AddEmployee.css';

const INITIAL_FORM = {
  nom: '',
  nom_jeune_fille: '',
  prenom: '',
  email: '',
  date_entree: new Date().toISOString().slice(0, 10),
  direction_id: '',
  departement_id: '',
  service_id: '',
};

function FormField({ label, name, value, onChange, required = false, type = 'text', children }) {
  return (
    <label className="add-employee-field" htmlFor={name}>
      <span>{label}{required && <span className="add-employee-required"> *</span>}</span>
      {children || (
        <input
          id={name}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          required={required}
        />
      )}
    </label>
  );
}

function AddEmployee() {
  const navigate = useNavigate();
  const [form, setForm] = useState(INITIAL_FORM);
  const [org, setOrg] = useState({ directions: [], departements: [], services: [] });
  const [loadingOrg, setLoadingOrg] = useState(true);
  const [orgError, setOrgError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get('/employe/directions'),
      api.get('/employe/departements'),
      api.get('/employe/services'),
    ])
      .then(([directions, departements, services]) => {
        if (!active) return;
        setOrg({
          directions: directions.data ?? [],
          departements: departements.data ?? [],
          services: services.data ?? [],
        });
      })
      .catch(() => {
        if (active) setOrgError('Impossible de charger la structure organisationnelle.');
      })
      .finally(() => {
        if (active) setLoadingOrg(false);
      });

    return () => { active = false; };
  }, []);

  const departments = form.direction_id
    ? org.departements.filter((item) => String(item.direction_id) === form.direction_id)
    : [];
  const services = org.services.filter((item) => {
    if (form.direction_id && String(item.direction_id) !== form.direction_id) return false;
    return !form.departement_id || !item.departement_id || String(item.departement_id) === form.departement_id;
  });

  function handleChange(event) {
    const { name, value } = event.target;
    setFeedback(null);
    setForm((current) => ({
      ...current,
      [name]: value,
      ...(name === 'direction_id' ? { departement_id: '', service_id: '' } : {}),
      ...(name === 'departement_id' ? { service_id: '' } : {}),
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setFeedback(null);

    const payload = {
      ...form,
      direction_id: Number(form.direction_id),
      departement_id: form.departement_id ? Number(form.departement_id) : null,
      service_id: form.service_id ? Number(form.service_id) : null,
      matricule: null,
      fonction: null,
      role_leave_validation: 'employe',
      can_create_for_employee: false,
      is_leave_responsible: false,
    };

    try {
      const response = await api.post('/employe/create', payload);
      setFeedback({
        type: 'success',
        text: `Employé créé (ID ${response.data.employeeId}). Mot de passe temporaire : ${response.data.temporaryPassword}`,
      });
      setForm({ ...INITIAL_FORM, date_entree: new Date().toISOString().slice(0, 10) });
    } catch (error) {
      setFeedback({
        type: 'error',
        text: error.response?.data?.message || error.response?.data?.error || 'La création de l’employé a échoué.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="add-employee-page">
      <Header />
      <main className="container py-4 py-md-5 add-employee-main">
      <header className="add-employee-header">
        <div>
          <p className="add-employee-eyebrow">Gestion du personnel</p>
          <h1>Ajouter un employé</h1>
          <p className="text-secondary mb-0 mt-1">Renseignez les informations personnelles et l’affectation de l’employé.</p>
        </div>
        <button type="button" className="add-employee-back" onClick={() => navigate(-1)}>
          Retour
        </button>
      </header>

      <form className="add-employee-form" onSubmit={handleSubmit}>
        <section className="add-employee-section">
          <div className="add-employee-section-heading">
            <span>01</span>
            <h2>Informations personnelles</h2>
          </div>
          <div className="add-employee-grid">
            <FormField label="Nom" name="nom" value={form.nom} onChange={handleChange} required />
            <FormField label="Nom de jeune fille" name="nom_jeune_fille" value={form.nom_jeune_fille} onChange={handleChange} required />
            <FormField label="Prénom" name="prenom" value={form.prenom} onChange={handleChange} required />
            <FormField label="Adresse e-mail" name="email" value={form.email} onChange={handleChange} type="email" required />
            <FormField label="Date d’entrée" name="date_entree" value={form.date_entree} onChange={handleChange} type="date" required />
          </div>
        </section>

        <section className="add-employee-section">
          <div className="add-employee-section-heading">
            <span>02</span>
            <h2>Affectation</h2>
          </div>
          {orgError && <p className="add-employee-feedback error" role="alert">{orgError}</p>}
          <div className="add-employee-grid">
            <FormField label="Direction" name="direction_id" value={form.direction_id} onChange={handleChange} required>
              <select id="direction_id" name="direction_id" value={form.direction_id} onChange={handleChange} required disabled={loadingOrg || Boolean(orgError)}>
                <option value="">Sélectionner une direction</option>
                {org.directions.map((item) => <option key={item.id} value={item.id}>{item.nom}</option>)}
              </select>
            </FormField>
            <FormField label="Département" name="departement_id" value={form.departement_id} onChange={handleChange}>
              <select id="departement_id" name="departement_id" value={form.departement_id} onChange={handleChange} disabled={!form.direction_id || loadingOrg || Boolean(orgError)}>
                <option value="">Aucun département</option>
                {departments.map((item) => <option key={item.id} value={item.id}>{item.nom}</option>)}
              </select>
            </FormField>
            <FormField label="Service" name="service_id" value={form.service_id} onChange={handleChange}>
              <select id="service_id" name="service_id" value={form.service_id} onChange={handleChange} disabled={!form.direction_id || loadingOrg || Boolean(orgError)}>
                <option value="">Aucun service</option>
                {services.map((item) => <option key={item.id} value={item.id}>{item.nom}</option>)}
              </select>
            </FormField>
          </div>
          {loadingOrg && <p className="add-employee-note">Chargement des directions et services…</p>}
        </section>

        {feedback && <p className={`add-employee-feedback ${feedback.type}`} role={feedback.type === 'error' ? 'alert' : 'status'}>{feedback.text}</p>}

        <footer className="add-employee-actions">
          <button type="button" className="add-employee-cancel" onClick={() => navigate(-1)}>Annuler</button>
          <button type="submit" className="add-employee-submit" disabled={submitting}>
            {submitting ? 'Création…' : 'Créer l’employé'}
          </button>
        </footer>
      </form>
      </main>
    </div>
  );
}

export default AddEmployee;
