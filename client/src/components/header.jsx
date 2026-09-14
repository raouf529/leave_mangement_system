import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import useCurrentUser from '../hooks/useCurrentUser';

function Header({ EmployeeName, EmployeeRole }) {
  const [openMenu, setOpenMenu] = useState(false);
  const location = useLocation();
  const { fullName, role } = useCurrentUser();

  const currentName = EmployeeName || fullName || '';
  const currentRole = EmployeeRole || role || '';
  const canSeeSupervisorLinks = ['head', 'hr'].includes(currentRole);

  return (
    <header className="app-header">
      <style>{`
        .app-header {
          --ink: #1B2430;
          --muted: #65707D;
          --surface: #FFFFFF;
          --border: #E4E8ED;
          --primary: #1F5673;
          --primary-soft: #E8F0F4;
          background: var(--surface);
          border-bottom: 1px solid var(--border);
        }
        .app-header .brand-title { color: var(--ink); }
        .app-header .icon-btn {
          width: 40px; height: 40px; border: none; background: var(--primary-soft); color: var(--primary);
          display: flex; align-items: center; justify-content: center; border-radius: 10px;
        }
        .app-header .icon-btn:disabled { opacity: 0.5; }
        .app-header .menu-panel { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; }
        .app-header .menu-link { display: block; padding: 0.55rem 1rem; color: var(--ink); text-decoration: none; font-size: 0.92rem; }
        .app-header .menu-link:hover { background: var(--primary-soft); }
        .app-header .user-name { color: var(--ink); font-weight: 600; }
        .app-header .user-role { color: var(--muted); font-size: 0.82rem; }
      `}</style>
      <div className="container d-flex align-items-center justify-content-between py-3 position-relative">
        <div className="d-flex align-items-center gap-3">
          <button
            type="button"
            className="icon-btn"
            onClick={() => setOpenMenu(!openMenu)}
            aria-label="Menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <h1 className="h5 fw-bold mb-0 brand-title">Gestion des congés</h1>

          {openMenu && (
            <nav
              className="position-absolute menu-panel shadow-sm py-2"
              style={{ top: '56px', left: '0', minWidth: '200px', zIndex: 1000 }}
            >
              <ul className="list-unstyled mb-0">
                <li>
                  <Link className="menu-link" to="/dashboard" onClick={() => setOpenMenu(false)}>
                    Profile
                  </Link>
                </li>
                {canSeeSupervisorLinks && (
                  <li>
                    <Link className="menu-link" to="/unit-info" onClick={() => setOpenMenu(false)}>
                      Mon équipe
                    </Link>
                  </li>
                )}
                {canSeeSupervisorLinks && (
                  <li>
                    <Link className="menu-link" to="/approval-inbox" onClick={() => setOpenMenu(false)}>
                      Boîte de réception
                    </Link>
                  </li>
                )}
              </ul>
            </nav>
          )}
        </div>

        <div className="d-flex align-items-center gap-3">
          {/* decorative only, not wired to any notification system */}
          <button type="button" className="icon-btn" aria-label="Notifications" disabled>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </button>

          <div className="text-end d-none d-sm-block">
            <p className="mb-0 user-name">{currentName}</p>
            <p className="mb-0 user-role">{currentRole}</p>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;