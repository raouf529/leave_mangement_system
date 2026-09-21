import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import useCurrentUser from '../hooks/useCurrentUser';
import api from './api';
import logo from '../assets/Nouveau logo catering .jpeg';

const LOGO_SRC = logo;

function Header({ EmployeeName, EmployeeRole, EmployeeRoleLabel }) {
  const [openMenu, setOpenMenu] = useState(false);
  const [openNotifications, setOpenNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loggingOut, setLoggingOut] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const linkProps = (path) => ({
    className: `menu-link${pathname === path ? ' active' : ''}`,
    'aria-current': pathname === path ? 'page' : undefined
  });
  const { fullName, role, roleLabel } = useCurrentUser();

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const response = await api.get('/notification', { skipAuthRedirect: true });
        if (isMounted) {
          setNotifications(response.data || []);
        }
      } catch {
        // silent fail on polling errors
      }
    };

    load();
    // Poll every 60 seconds (60000ms) for new notifications
    const interval = setInterval(load, 60000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleMarkAsRead = async (notificationId, e) => {
    e.stopPropagation();
    try {
      await api.post(`/notification/${notificationId}/read`);
      setNotifications((prev) =>
        prev.map((n) =>
          n.notification_id === notificationId ? { ...n, is_read: true } : n
        )
      );
    } catch {
      console.error('Failed to mark notification as read');
    }
  };

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await api.post('/auth/logout');
    } finally {
      sessionStorage.removeItem('role');
      setOpenMenu(false);
      setLoggingOut(false);
      navigate('/', { replace: true });
    }
  }

  const currentName = EmployeeName || fullName || '';
  const currentRole = EmployeeRole || role || '';
  const displayedRole = EmployeeRoleLabel || roleLabel || currentRole;
  const canSeeSupervisorLinks = ['head', 'hr', 'admin'].includes(currentRole);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

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
          --danger: #B03A2E;
          --danger-soft: #FBEBE9;
          background: var(--surface);
          border-bottom: 1px solid var(--border);
          box-shadow: 0 1px 2px rgba(27, 36, 48, 0.04);
        }
        .app-header .logo-tile {
          width: 180px; height: 48px; flex: none; overflow: hidden;
          display: flex; align-items: center; justify-content: center;
          background: var(--surface);
        }
        .app-header .logo-tile img { width: 100%; height: 100%; object-fit: contain; }
        .app-header .logo-tile.logo-fallback {
          background: var(--primary); color: #fff; border-radius: 10px;
          font-weight: 700; font-size: 0.95rem; letter-spacing: 0.02em;
        }

        /* Icon buttons */
        .app-header .icon-btn {
          width: 40px; height: 40px; border: none; background: transparent; color: var(--muted);
          display: flex; align-items: center; justify-content: center; border-radius: 10px;
          position: relative; transition: background 150ms ease, color 150ms ease;
        }
        .app-header .icon-btn:hover:not(:disabled),
        .app-header .icon-btn[aria-expanded="true"] { background: var(--primary-soft); color: var(--primary); }
        .app-header .icon-btn:focus-visible,
        .app-header .logout-btn:focus-visible,
        .app-header .menu-link:focus-visible,
        .app-header .mark-read-btn:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
        .app-header .icon-btn:disabled { opacity: 0.5; }
        .app-header .badge-counter {
          position: absolute; top: -4px; right: -4px;
          background: var(--danger); color: #fff; border-radius: 10px;
          padding: 2px 6px; font-size: 0.7rem; font-weight: 700; min-width: 18px; text-align: center;
          line-height: 1; border: 2px solid var(--surface);
        }

        /* Dropdown panels */
        .app-header .menu-panel,
        .app-header .notif-panel {
          background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
          box-shadow: 0 12px 32px rgba(27, 36, 48, 0.12);
        }
        .app-header .menu-panel { padding: 0.375rem; }
        .app-header .menu-link {
          display: block; padding: 0.55rem 0.75rem; border-radius: 8px;
          color: var(--ink); text-decoration: none; font-size: 0.92rem;
          transition: background 150ms ease;
        }
        .app-header .menu-link:hover { background: var(--primary-soft); }
        .app-header .menu-link.active { background: var(--primary-soft); color: var(--primary); font-weight: 600; }

        /* Notifications */
        .app-header .notif-panel {
          width: 340px; max-width: calc(100vw - 24px); max-height: 400px; overflow-y: auto;
          right: 0; top: calc(100% + 20px); z-index: 1000;
        }
        .app-header .notif-head {
          position: sticky; top: 0; z-index: 1;
          padding: 0.75rem 1rem; background: var(--surface); border-bottom: 1px solid var(--border);
        }
        .app-header .unread-pill {
          background: var(--danger-soft); color: var(--danger);
          border-radius: 999px; padding: 0.15rem 0.6rem; font-size: 0.75rem; font-weight: 600;
        }
        .app-header .notif-item {
          padding: 0.75rem 1rem; border-bottom: 1px solid var(--border);
          font-size: 0.85rem; line-height: 1.4;
          transition: background 150ms ease;
        }
        .app-header .notif-item.unread { background: var(--primary-soft); box-shadow: inset 3px 0 0 var(--primary); font-weight: 500; }
        .app-header .notif-item:last-child { border-bottom: none; }
        .app-header .notif-date { font-size: 0.75rem; color: var(--muted); }
        .app-header .notif-empty { padding: 1.5rem 1rem; text-align: center; color: var(--muted); font-size: 0.875rem; }
        .app-header .mark-read-btn {
          flex: none; margin-top: 0.15rem; padding: 0.15rem 0.6rem;
          border: 1px solid var(--border); border-radius: 8px; background: var(--surface);
          color: var(--primary); font-size: 0.75rem; font-weight: 600;
          transition: background 150ms ease;
        }
        .app-header .mark-read-btn:hover { background: var(--primary-soft); }

        /* User block + logout */
        .app-header .user-name { color: var(--ink); font-weight: 600; }
        .app-header .user-role { color: var(--muted); font-size: 0.82rem; }
        .app-header .logout-btn {
          display: inline-flex; align-items: center; gap: 0.35rem; min-height: 36px;
          padding: 0.35rem 0.65rem; border: 1px solid var(--border); border-radius: 9px;
          background: var(--surface); color: var(--ink); font-size: 0.82rem; font-weight: 600;
          transition: background 150ms ease, border-color 150ms ease, color 150ms ease;
        }
        .app-header .logout-btn:hover:not(:disabled) { background: var(--primary-soft); border-color: var(--primary-soft); color: var(--primary); }
        .app-header .logout-btn:disabled { cursor: wait; opacity: 0.65; }
        .app-header .logout-btn svg { flex: 0 0 auto; }

        @media (max-width: 575.98px) {
          .app-header .logo-tile { width: 132px; height: 38px; }
          .app-header .logout-label { display: none; }
          .app-header .logout-btn { width: 40px; justify-content: center; padding: 0; }
        }
      `}</style>
      <div className="container-fluid px-3 px-md-4 d-flex align-items-center justify-content-between py-2 position-relative" style={{ minHeight: '72px' }}>
        <div className="d-flex align-items-center gap-2">
          <button
            type="button"
            className="icon-btn"
            onClick={() => {
              setOpenMenu(!openMenu);
              setOpenNotifications(false);
            }}
            aria-label="Menu"
            aria-expanded={openMenu}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <div className={`logo-tile ${LOGO_SRC ? '' : 'logo-fallback'}`}>
            {LOGO_SRC ? <img src={LOGO_SRC} alt="Logo" /> : 'GC'}
          </div>

          {openMenu && (
            <nav
              className="position-absolute menu-panel"
              style={{ top: '100%', left: '0', marginTop: '4px', minWidth: '200px', zIndex: 1000 }}
            >
              <ul className="list-unstyled mb-0">
                <li>
                  <Link {...linkProps('/dashboard')} to="/dashboard" onClick={() => setOpenMenu(false)}>
                    Tableau de bord
                  </Link>
                </li>
                {canSeeSupervisorLinks && (
                  <li>
                    <Link {...linkProps('/unit-info')} to="/unit-info" onClick={() => setOpenMenu(false)}>
                      Mon équipe
                    </Link>
                  </li>
                )}
                {canSeeSupervisorLinks && (
                  <li>
                    <Link {...linkProps('/approval-inbox')} to="/approval-inbox" onClick={() => setOpenMenu(false)}>
                      Boîte de réception
                    </Link>
                  </li>
                )}
                {currentRole === 'admin' && (
                  <li>
                    <Link {...linkProps('/admin')} to="/admin" onClick={() => setOpenMenu(false)}>
                      Administration
                    </Link>
                  </li>
                )}
              </ul>
            </nav>
          )}
        </div>

        <div className="d-flex align-items-center gap-2 position-relative">
          {/* Notification button with 60s polling */}
          <button
            type="button"
            className="icon-btn"
            aria-label="Notifications"
            aria-expanded={openNotifications}
            onClick={() => {
              setOpenNotifications(!openNotifications);
              setOpenMenu(false);
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {unreadCount > 0 && (
              <span className="badge-counter">{unreadCount > 99 ? '99+' : unreadCount}</span>
            )}
          </button>

          {openNotifications && (
            <div className="position-absolute notif-panel p-0">
              <div className="d-flex justify-content-between align-items-center notif-head">
                <h6 className="mb-0 fw-bold">Notifications</h6>
                {unreadCount > 0 && (
                  <span className="unread-pill">{unreadCount} non lue(s)</span>
                )}
              </div>
              <div className="notif-list">
                {notifications.length === 0 ? (
                  <div className="notif-empty">Aucune notification</div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.notification_id}
                      className={`notif-item ${!notif.is_read ? 'unread' : ''}`}
                    >
                      <div className="d-flex justify-content-between align-items-start gap-2">
                        <div>
                          <p className="mb-1 text-dark">{notif.content}</p>
                          <small className="notif-date">
                            {new Date(notif.created_at).toLocaleString()}
                          </small>
                        </div>
                        {!notif.is_read && (
                          <button
                            type="button"
                            className="mark-read-btn"
                            onClick={(e) => handleMarkAsRead(notif.notification_id, e)}
                          >
                            Lu
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="text-end d-none d-sm-block">
            <p className="mb-0 user-name">{currentName}</p>
            <p className="mb-0 user-role">{displayedRole}</p>
          </div>
          <div className="text-end">
            <button
              type="button"
              className="logout-btn"
              onClick={handleLogout}
              disabled={loggingOut}
              aria-label="Déconnexion"
              title="Déconnexion"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10 17l5-5-5-5" />
                <path d="M15 12H3" />
                <path d="M21 19V5a2 2 0 0 0-2-2h-6" />
              </svg>
              <span className="logout-label">{loggingOut ? 'Déconnexion...' : 'Déconnexion'}</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
export default Header;