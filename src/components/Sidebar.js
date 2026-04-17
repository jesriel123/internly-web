import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ProfilePictureDisplay from "./ProfilePictureDisplay";
import { logButtonClick, logNavigation } from "../utils/debugLogger";
import "./Sidebar.css";

const IcoDashboard = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    width="20"
    height="20"
  >
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);
const IcoUsers = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    width="20"
    height="20"
  >
    <circle cx="9" cy="7" r="4" />
    <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    <path d="M21 21v-2a4 4 0 0 0-3-3.87" />
  </svg>
);
const IcoCompanies = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    width="20"
    height="20"
  >
    <rect x="2" y="7" width="20" height="14" rx="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    <path d="M6 11h.01M6 15h.01M18 11h.01M18 15h.01" />
  </svg>
);
const IcoTimeLogs = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    width="20"
    height="20"
  >
    <circle cx="12" cy="12" r="9" />
    <polyline points="12 7 12 12 15.5 12" />
  </svg>
);
const IcoReports = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    width="20"
    height="20"
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="8" y1="13" x2="16" y2="13" />
    <line x1="8" y1="17" x2="16" y2="17" />
    <line x1="8" y1="9" x2="10" y2="9" />
  </svg>
);
const IcoSettings = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    width="20"
    height="20"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);
const IcoAuditLogs = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    width="20"
    height="20"
  >
    <path d="M9 11l3 3L22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
);
const IcoLogo = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="#fff"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    width="22"
    height="22"
  >
    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
    <path d="M6 12v5c3.33 2 8.67 2 12 0v-5" />
  </svg>
);
const IcoSignOut = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    width="16"
    height="16"
  >
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);
const IcoBell = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    width="20"
    height="20"
  >
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const NAV = [
  { to: "/", label: "Dashboard", Icon: IcoDashboard },
  { to: "/users", label: "Users", Icon: IcoUsers },
  { to: "/companies", label: "Companies", Icon: IcoCompanies },
  { to: "/timelogs", label: "Time Logs", Icon: IcoTimeLogs },
  { to: "/reports", label: "Reports", Icon: IcoReports },
  { to: "/notifications", label: "Notifications", Icon: IcoBell },
];

const SUPER_NAV = [
  { to: "/settings", label: "Settings", Icon: IcoSettings },
  { to: "/audit-logs", label: "Audit Logs", Icon: IcoAuditLogs },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const handleLogout = () => {
    logButtonClick("WEB_LOGOUT");
    logout();
  };

  return (
    <aside className="sidebar">
      <div className="sb-brand">
        <span className="sb-logo">
          <IcoLogo />
        </span>
        <div>
          <h2>Internly</h2>
          <small>Admin Panel</small>
        </div>
      </div>

      <nav className="sb-nav">
        {NAV.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) => `sb-link${isActive ? " active" : ""}`}
            onClick={() => logNavigation(location.pathname, to)}
          >
            <span className="sb-icon">
              <Icon />
            </span>
            {label}
          </NavLink>
        ))}
        {user?.role === "super_admin" &&
          SUPER_NAV.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `sb-link${isActive ? " active" : ""}`
              }
              onClick={() => logNavigation(location.pathname, to)}
            >
              <span className="sb-icon">
                <Icon />
              </span>
              {label}
            </NavLink>
          ))}
      </nav>

      <div className="sb-bottom">
        <div className="sb-user">
          <ProfilePictureDisplay
            profilePictureUrl={user?.profilePictureUrl}
            name={user?.name}
            email={user?.email}
            size="small"
            className="sb-avatar"
          />
          <div className="sb-user-info">
            <strong>{user?.name || "Admin"}</strong>
            <small>
              {user?.role === "super_admin" ? "Super Admin" : "Admin"}
            </small>
          </div>
        </div>
        <button className="sb-logout" onClick={handleLogout}>
          <IcoSignOut /> Sign Out
        </button>
      </div>
    </aside>
  );
}
