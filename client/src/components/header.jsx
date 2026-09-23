import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import useCurrentUser from '../hooks/useCurrentUser';
import api from './api';
import logo from '../assets/Nouveau logo catering .jpeg';
import './header.css';

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
                {(currentRole === 'hr' || currentRole === 'admin') && (
                  <li>
                    <Link className="menu-link" to="/leave-titles" onClick={() => setOpenMenu(false)}>
                      Titres de congé
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