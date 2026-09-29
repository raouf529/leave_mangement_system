import { useEffect, useState } from 'react';
import api from './api';
import Header from './header';
import './EmployeeProfile.css';

function formatDate(value) {
  if (!value) return 'Non renseignée';
  const [year, month, day] = String(value).slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return 'Non renseignée';
  return new Date(year, month - 1, day).toLocaleDateString('fr-FR');
}

export default function EmployeeProfile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api.get('/profile/me')
      .then((response) => {
        if (active) setProfile(response.data);
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.error || 'Impossible de charger votre profil.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, []);

  const fields = profile ? [
    ['Prénom', profile.firstName],
    ['Nom', profile.lastName],
    ['Nom de jeune fille', profile.maidenName],
    ['Adresse e-mail', profile.email],
    ['Matricule', profile.matricule],
    ['Fonction', profile.jobTitle],
    ['Rôle', profile.roleLabel || profile.role],
    ['Unité', profile.unit?.name],
    ['Date d’entrée', formatDate(profile.recrutement_date)],
  ] : [];

  return (
    <div className="employee-profile-page">
      <Header />
      <main className="employee-profile-main">
        <header className="employee-profile-heading">
          <p className="employee-profile-eyebrow">Espace personnel</p>
          <h1>Mon profil</h1>
          <p>Informations personnelles enregistrées dans votre dossier employé.</p>
        </header>

        {loading && <p className="employee-profile-message" role="status">Chargement du profil…</p>}
        {!loading && error && <p className="employee-profile-message is-error" role="alert">{error}</p>}

        {!loading && !error && profile && (
          <section className="employee-profile-section" aria-labelledby="employee-profile-section-title">
            <div className="employee-profile-identity">
              <div className="employee-profile-avatar" aria-hidden="true">
                {(profile.firstName || '?').trim().charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 id="employee-profile-section-title">{`${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim()}</h2>
                <p>{profile.roleLabel || profile.role || 'Employé'}</p>
              </div>
            </div>

            <dl className="employee-profile-grid">
              {fields.map(([label, value]) => (
                <div className="employee-profile-field" key={label}>
                  <dt>{label}</dt>
                  <dd>{value === null || value === undefined || value === '' ? 'Non renseigné' : value}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}
      </main>
    </div>
  );
}