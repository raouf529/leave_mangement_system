import { useState } from 'react';
import api from './api';
import Header from './header';
import logo from '../assets/Nouveau logo catering .jpeg';
import './LeaveTitles.css';

const LEAVE_TYPE_LABELS = {
  annual: 'Annuel',
  exceptional: 'Exceptionnel',
  advance: 'Par anticipation'
};

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('fr-FR');
}

function getEndDate(startDate, duration) {
  const end = new Date(startDate);
  end.setDate(end.getDate() + Number(duration) - 1);
  return end;
}

function titleDocumentMarkup(title, allocation) {
  const start = formatDate(allocation.period?.start ?? title.period.start);
  const end = formatDate(allocation.period?.end ?? title.period.end);
  return `
    <article class="leave-title-print">
      <div class="title-heading"><h1>TITRE DE CONGE</h1><p>Exercice ${allocation.year}</p></div>
      <div class="title-number">N° ______ / 26</div>
      <div class="title-grid">
        <div><b>Bénéficiaire :</b><span>${title.name}</span></div>
        <div><b>MATRCULE :</b><span>${title.matricule ?? '—'}</span></div>
        <div><b>Qualité :</b><span>&nbsp;</span></div>
        <div><b>Congé accordé :</b><span>${LEAVE_TYPE_LABELS[title.leaveType] ?? title.leaveType}</span></div>
        <div><b>De :</b><span>${start}</span></div>
        <div><b>Jours :</b><span>${allocation.daysAllocated}</span></div>
        <div><b>Valable :</b><span>Du ${start}</span></div>
        <div><b>Au :</b><span>${end}</span></div>
        <div><b>Reste à prendre :</b><span>${allocation.remainingAfter ?? '—'} jours</span></div>
      </div>
      <div class="title-footer">AHR le, ____________________</div>
    </article>`;
}

async function getTemplateDocument(title, allocation) {
  const response = await api.get(`/request/${title.requestId}/title/document`, {
    params: { exerciseId: allocation.exerciseId },
    responseType: 'blob'
  });
  return response.data;
}

async function downloadDocument(title, allocation) {
  const blob = await getTemplateDocument(title, allocation);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `titre-conge-${title.matricule ?? title.name}-${allocation.year}.odt`;
  link.click();
  URL.revokeObjectURL(url);
}

async function printDocument(title, allocation) {
  const blob = await getTemplateDocument(title, allocation);
  const url = URL.createObjectURL(blob);
  const printWindow = window.open(url, '_blank', 'width=1000,height=800');
  if (printWindow) {
    printWindow.addEventListener('load', () => printWindow.print());
  }
}

const DOCUMENT_CSS = `
  * { box-sizing: border-box; }
  body { margin: 0; padding: 24px; color: #111; font-family: Arial, sans-serif; background: #fff; }
  .leave-title-print { max-width: 980px; min-height: 660px; margin: 0 auto; padding: 30px 42px; border: 1px solid #222; position: relative; }
  .title-company { display: flex; align-items: center; gap: 18px; min-height: 76px; }
  .title-company img { width: 170px; max-height: 70px; object-fit: contain; }
  .title-company div { display: flex; flex-direction: column; gap: 5px; font-size: 15px; }
  .title-heading { margin: 32px 0 25px 185px; }
  .title-heading h1 { margin: 0; font-size: 25px; letter-spacing: .02em; }
  .title-heading p { margin: 4px 0 0; font-size: 20px; font-weight: 700; }
  .title-number { position: absolute; top: 130px; right: 48px; font-weight: 700; }
  .title-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 22px 42px; font-size: 18px; }
  .title-grid div { display: flex; gap: 18px; align-items: baseline; }
  .title-grid b { min-width: 150px; }
  .title-grid span { border-bottom: 1px solid #222; min-width: 145px; padding: 0 4px 3px; }
  .title-footer { text-align: right; margin-top: 58px; font-weight: 700; }
  @media print { body { padding: 0; } .leave-title-print { border: 0; max-width: none; min-height: 100vh; } }
`;

export default function LeaveTitles() {
  const [search, setSearch] = useState('');
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [titles, setTitles] = useState({});
  async function searchRequests(event) {
    event?.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/admin/leave-titles', { params: { search } });
      setRequests(response.data ?? []);
      setTitles({});
    } catch (err) {
      setError(err.response?.data?.error ?? 'Impossible de charger les congés approuvés.');
    } finally {
      setLoading(false);
    }
  }

  async function createTitle(request) {
    setError('');
    try {
      const response = await api.get(`/request/${request.request_id}/title`);
      setTitles((current) => ({ ...current, [request.request_id]: response.data }));
    } catch (err) {
      setError(err.response?.data?.error ?? 'Impossible de générer le titre.');
    }
  }

  return (
    <div className="leave-titles-page">
      <Header />
      <main className="leave-titles-main">
        <section className="leave-titles-hero">
          <h1>Création des titres de congé</h1>
          <p className="leave-titles-muted mb-0">Recherchez un employé pour retrouver ses congés approuvés et générer un titre par exercice.</p>
          <form className="leave-titles-search" onSubmit={searchRequests}>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Matricule ou nom de l'employé" aria-label="Matricule ou nom" />
            <button className="leave-titles-btn primary" type="submit" disabled={loading}>{loading ? 'Recherche...' : 'Rechercher'}</button>
          </form>
        </section>

        {error && <div className="alert alert-danger" role="alert">{error}</div>}
        <section className="leave-titles-panel">
          <h2 className="h4 mb-3">Congés approuvés</h2>
          {requests.length === 0 ? <p className="leave-titles-muted mb-0">Aucun congé approuvé à afficher.</p> : (
            <div className="leave-titles-table-wrap">
              <table className="leave-titles-table"><thead><tr><th>Matricule</th><th>Employé</th><th>Type</th><th>Période</th><th>Durée</th><th>Action</th></tr></thead>
                <tbody>{requests.map((request) => <tr key={request.request_id}>
                  <td><strong>{request.matricule ?? '—'}</strong></td>
                  <td>{request.nom} {request.prenom}</td>
                  <td>{LEAVE_TYPE_LABELS[request.leave_type] ?? request.leave_type}</td>
                  <td>{formatDate(request.start_date)} → {formatDate(getEndDate(request.start_date, request.duration))}</td>
                  <td>{request.duration} j</td>
                  <td><button className="leave-titles-btn primary" type="button" onClick={() => createTitle(request)}>Créer le titre</button></td>
                </tr>)}</tbody>
              </table>
            </div>
          )}
        </section>

        {Object.entries(titles).map(([requestId, title]) => (
          <section className="title-preview" key={requestId}>
            <div className="d-flex justify-content-between align-items-center gap-3 mb-3"><h2 className="h4 mb-0">Titres générés</h2><span className="leave-titles-muted">{title.name}</span></div>
            <div className="title-preview-grid">{title.exercises.map((allocation) => <article className="title-card" key={allocation.exerciseId}>
              <div className="title-card-header"><img className="title-card-logo" src={logo} alt="Logo" /><h3>Exercice {allocation.year}</h3></div>
              <div className="title-card-row"><span>Bénéficiaire</span><strong>{title.name}</strong></div>
              <div className="title-card-row"><span>Matricule</span><strong>{title.matricule ?? '—'}</strong></div>
              <div className="title-card-row"><span>Qualité</span><strong>{title.qualite ?? '—'}</strong></div>
              <div className="title-card-row"><span>Congé accordé</span><strong>{LEAVE_TYPE_LABELS[title.leaveType] ?? title.leaveType}</strong></div>
              <div className="title-card-row"><span>Période</span><strong>{formatDate(allocation.period?.start ?? title.period.start)} → {formatDate(allocation.period?.end ?? title.period.end)}</strong></div>
              <div className="title-card-row"><span>Jours exercice</span><strong>{allocation.daysAllocated} j</strong></div>
              <div className="title-card-row"><span>Reste à prendre</span><strong>{allocation.remainingAfter ?? '—'} j</strong></div>
              <div className="d-flex justify-content-end gap-2 mt-3"><button className="leave-titles-btn secondary" type="button" onClick={() => downloadDocument(title, allocation)}>Télécharger le modèle</button><button className="leave-titles-btn primary" type="button" onClick={() => printDocument(title, allocation)}>Imprimer le modèle</button></div>
            </article>)}</div>
          </section>
        ))}
      </main>
    </div>
  );
}