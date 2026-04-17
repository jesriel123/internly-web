import React from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import ProfilePictureDisplay from "./ProfilePictureDisplay";
import NotificationBell from "./NotificationBell";
import { useAuth } from "../context/AuthContext";
import "./AdminLayout.css";

export default function AdminLayout() {
  const { user } = useAuth();

  return (
    <div className="admin-layout">
      <Sidebar />
      <div className="admin-wrapper">
        <header className="admin-header">
          <div className="header-search">
            {/* Search block for future use */}
          </div>
          <div className="header-profile">
            <NotificationBell />
            <div className="hp-info">
              <span className="hp-name">
                {user?.name || user?.email || "Admin"}
              </span>
              <span className="hp-role">Administrator</span>
            </div>
            <ProfilePictureDisplay
              profilePictureUrl={user?.profilePictureUrl}
              name={user?.name}
              email={user?.email}
              size="medium"
              className="hp-avatar"
            />
          </div>
        </header>
        <main className="admin-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
