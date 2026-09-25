import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import useCurrentUser from '../hooks/useCurrentUser';
import api from './api';
import logo from '../assets/Nouveau logo catering .jpeg';
import './header.css';

const LOGO_SRC = logo;

const ICONS = {
  dashboard: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  team: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  inbox: 'M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z',
  admin: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  titles: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8',
  addUser: 'M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M8.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM20 8v6M23 11h-6'
};

function NavIcon({ name }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

function Header({ EmployeeName, EmployeeRole, EmployeeRoleLabel, onRequestLeave }) {
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

  useEffect(() => {
    document.body.classList.add('has-sidebar');
    return () => document.body.classList.remove('has-sidebar');
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

  const navItems = [
    { to: '/dashboard', label: 'Tableau de bord', icon: 'dashboard', show: true },
    { to: '/unit-info', label: 'Mon équipe', icon: 'team', show: canSeeSupervisorLinks },
    { to: '/approval-inbox', label: 'Boîte de réception', icon: 'inbox', show: canSeeSupervisorLinks },
    { to: '/admin', label: 'Administration', icon: 'admin', show: currentRole === 'admin' },
    { to: '/leave-titles', label: 'Titres de congé', icon: 'titles', show: ['hr', 'drh', 'admin'].includes(currentRole) },
    { to: '/add-employee', label: 'Ajouter un employé', icon: 'addUser', show: ['hr', 'drh'].includes(currentRole) }
  ].filter((item) => item.show);

  const bellButton = (
    <button
      type="button"
      className="icon-btn"
      aria-label="Notifications"
      aria-expanded={openNotifications}
      onClick={() => setOpenNotifications(!openNotifications)}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {unreadCount > 0 && (
        <span className="badge-counter">{unreadCount > 99 ? '99+' : unreadCount}</span>
      )}
    </button>
  );

  return (
    <>
      {/* Mobile top bar (hidden on desktop) */}
      <div className="sidebar-topbar">
        <button
          type="button"
          className="icon-btn"
          onClick={() => setOpenMenu(true)}
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
        <div className="topbar-bell">{bellButton}</div>
      </div>

      {openMenu && <div className="sidebar-backdrop" onClick={() => setOpenMenu(false)} />}

      <aside className={`app-sidebar${openMenu ? ' open' : ''}`}>
        <div className="sidebar-brand">
          <div className={`logo-tile ${LOGO_SRC ? '' : 'logo-fallback'}`}>
            {LOGO_SRC ? <img src={LOGO_SRC} alt="Logo" /> : 'GC'}
          </div>
          <div className="sidebar-bell">{bellButton}</div>
        </div>

        {onRequestLeave && (
          <div className="sidebar-cta">
            <button
              type="button"
              className="btn-request"
              onClick={() => {
                setOpenMenu(false);
                onRequestLeave();
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Demander un congé
            </button>
          </div>
        )}

        <nav className="sidebar-nav" aria-label="Navigation principale">
          {navItems.map((item) => (
            <Link
              key={item.to}
              {...linkProps(item.to)}
              to={item.to}
              onClick={() => setOpenMenu(false)}
            >
              <NavIcon name={item.icon} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="user-avatar" aria-hidden="true">
              {(currentName || '?').trim().charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="mb-0 user-name text-truncate">{currentName}</p>
              <p className="mb-0 user-role text-truncate">{displayedRole}</p>
            </div>
          </div>
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
      </aside>

      {openNotifications && (
        <>
          <div className="notif-backdrop" onClick={() => setOpenNotifications(false)} />
          <div className="notif-panel">
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
        </>
      )}
    </>
  );
}
export default Header;