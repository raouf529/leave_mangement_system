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
    <header className="bg-white shadow-sm">
      <div className="container d-flex align-items-center justify-content-between py-3 position-relative">
        <div className="d-flex align-items-center gap-3">
          <button
            type="button"
            className="btn btn-light border-0 d-flex align-items-center justify-content-center rounded-3"
            style={{ width: '40px', height: '40px' }}
            onClick={() => setOpenMenu(!openMenu)}
            aria-label="Menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <h1 className="h5 fw-bold mb-0">Gestion des congés</h1>

          {openMenu && (
            <nav
              className="position-absolute bg-white shadow rounded-3 py-2"
              style={{ top: '56px', left: '0', minWidth: '200px', zIndex: 1000 }}
            >
              <ul className="list-unstyled mb-0">
                <li>
                  <Link className="d-block px-3 py-2 text-decoration-none text-dark" to="/dashboard" onClick={() => setOpenMenu(false)}>
                    Profile
                  </Link>
                </li>
                {canSeeSupervisorLinks && (
                  <li>
                    <Link className="d-block px-3 py-2 text-decoration-none text-dark" to="/unit-info" onClick={() => setOpenMenu(false)}>
                      mon equipe
                    </Link>
                  </li>
                )}
                {canSeeSupervisorLinks && (
                  <li>
                    <Link className="d-block px-3 py-2 text-decoration-none text-dark" to="/approval-inbox" onClick={() => setOpenMenu(false)}>
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
          <button
            type="button"
            className="btn btn-light border-0 rounded-3 d-flex align-items-center justify-content-center"
            style={{ width: '40px', height: '40px' }}
            aria-label="Notifications"
            disabled
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </button>

          <div className="text-end d-none d-sm-block">
            <p className="mb-0 fw-medium">{currentName}</p>
            <p className="mb-0 text-muted small">{currentRole}</p>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;