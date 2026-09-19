import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import useCurrentUser from '../hooks/useCurrentUser';
import api from './api';

function Header({ EmployeeName, EmployeeRole, EmployeeRoleLabel }) {
  const [openMenu, setOpenMenu] = useState(false);
  const [openNotifications, setOpenNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loggingOut, setLoggingOut] = useState(false);
  const navigate = useNavigate();
  const { fullName, role, roleLabel } = useCurrentUser();

  const fetchNotifications = async () => {
    try {
      const response = await api.get('/notification');
      setNotifications(response.data || []);
    } catch (err) {
      // silent fail on polling errors
    }
  };

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const response = await api.get('/notification', { skipAuthRedirect: true });
        if (isMounted) {
          setNotifications(response.data || []);
        }
      } catch (err) {
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
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
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
          background: var(--surface);
          border-bottom: 1px solid var(--border);
        }
        .app-header .brand-title { color: var(--ink); }
        .app-header .icon-btn {
          width: 40px; height: 40px; border: none; background: var(--primary-soft); color: var(--primary);
          display: flex; align-items: center; justify-content: center; border-radius: 10px;
          position: relative;
        }
        .app-header .icon-btn:disabled { opacity: 0.5; }
        .app-header .badge-counter {
          position: absolute; top: -4px; right: -4px;
          background: #DC3545; color: white; border-radius: 10px;
          padding: 2px 6px; font-size: 0.7rem; font-weight: 700; min-width: 18px; text-align: center;
          line-height: 1; border: 2px solid white;
        }
        .app-header .menu-panel, .app-header .notif-panel {
          background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
        }
        .app-header .menu-link { display: block; padding: 0.55rem 1rem; color: var(--ink); text-decoration: none; font-size: 0.92rem; }
        .app-header .menu-link:hover { background: var(--primary-soft); }
        .app-header .notif-panel {
          width: 320px; max-height: 400px; overflow-y: auto; right: 0; top: 56px; z-index: 1000;
        }
        .app-header .notif-item {
          padding: 0.75rem 1rem; border-bottom: 1px solid var(--border); font-size: 0.85rem;
          transition: background 150ms ease;
        }
        .app-header .notif-item.unread { background: #F0F7FF; font-weight: 500; }
        .app-header .notif-item:last-child { border-bottom: none; }
        .app-header .user-name { color: var(--ink); font-weight: 600; }
        .app-header .user-role { color: var(--muted); font-size: 0.82rem; }
        .app-header .logout-btn {
          display: inline-flex; align-items: center; gap: 0.45rem; min-height: 40px;
          padding: 0.5rem 0.8rem; border: 1px solid #E4B7B7; border-radius: 10px;
          background: #FFF7F7; color: #A33A3A; font-size: 0.88rem; font-weight: 600;
          transition: background 150ms ease, border-color 150ms ease, color 150ms ease;
        }
        .app-header .logout-btn:hover:not(:disabled) { background: #FCEAEA; border-color: #D99696; color: #872D2D; }
        .app-header .logout-btn:disabled { cursor: wait; opacity: 0.65; }
        .app-header .logout-btn svg { flex: 0 0 auto; }
        @media (max-width: 575.98px) {
          .app-header .logout-label { display: none; }
          .app-header .logout-btn { width: 40px; justify-content: center; padding: 0; }
        }
      `}</style>
      <div className="container d-flex align-items-center justify-content-between py-3 position-relative">
        <div className="d-flex align-items-center gap-3">
          <button
            type="button"
            className="icon-btn"
            onClick={() => {
              setOpenMenu(!openMenu);
              setOpenNotifications(false);
            }}
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
                    Tableau de bord
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
                {currentRole === 'admin' && (
                  <li>
                    <Link className="menu-link" to="/admin" onClick={() => setOpenMenu(false)}>
                      Administration
                    </Link>
                  </li>
                )}
              </ul>
            </nav>
          )}
        </div>

        <div className="d-flex align-items-center gap-3 position-relative">
          {/* Notification button with 60s polling */}
          <button
            type="button"
            className="icon-btn"
            aria-label="Notifications"
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
            <div className="position-absolute notif-panel shadow-sm p-0">
              <div className="d-flex justify-content-between align-items-center p-3 border-bottom">
                <h6 className="mb-0 fw-bold">Notifications</h6>
                {unreadCount > 0 && (
                  <span className="badge bg-danger rounded-pill">{unreadCount} non lue(s)</span>
                )}
              </div>
              <div className="notif-list">
                {notifications.length === 0 ? (
                  <div className="p-3 text-center text-muted small">Aucune notification</div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.notification_id}
                      className={`notif-item ${!notif.is_read ? 'unread' : ''}`}
                    >
                      <div className="d-flex justify-content-between align-items-start gap-2">
                        <div>
                          <p className="mb-1 text-dark">{notif.content}</p>
                          <small className="text-muted" style={{ fontSize: '0.75rem' }}>
                            {new Date(notif.created_at).toLocaleString()}
                          </small>
                        </div>
                        {!notif.is_read && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary py-0 px-2 mt-1"
                            style={{ fontSize: '0.75rem' }}
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