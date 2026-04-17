import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseConfig";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { Moon, Sun, Upload, X } from "lucide-react";
import {
  uploadProfilePicture,
  updateUserProfilePicture,
  deleteProfilePicture,
  validateImage,
} from "../utils/profilePictureUtils";
import ProfilePictureDisplay from "../components/ProfilePictureDisplay";
import "./SettingsPage.css";

const DEFAULT_CONFIG = {
  defaultRequiredHours: 486,
  defaultDailyMaxHours: 8,
};

export default function SettingsPage() {
  const { user: me, refreshProfile } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [userProfile, setUserProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploadError, setUploadError] = useState("");

  useEffect(() => {
    fetchConfig();
  }, []);

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const { data, error } = await supabase
          .from("users")
          .select("id, name, email, profile_picture_url")
          .eq("id", me.uid)
          .single();
        if (error) throw error;
        setUserProfile(data);
      } catch (err) {
        console.error("Failed to fetch user profile:", err);
      }
    };

    if (me?.uid) {
      fetchUserProfile();
    }
  }, [me?.uid]);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("settings")
        .select("*")
        .eq("id", "global")
        .single();
      if (error && error.code !== "PGRST116") throw error;
      if (data) setConfig({ ...DEFAULT_CONFIG, ...data });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    setMsg("");
    try {
      const { error } = await supabase
        .from("settings")
        .upsert({ id: "global", ...config });
      if (error) throw error;
      setMsg("Settings saved successfully!");
      setTimeout(() => setMsg(""), 3000);
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleProfilePictureChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError("");
    const validation = validateImage(file);

    if (!validation.valid) {
      setUploadError(validation.error);
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (event) => {
      setPreviewUrl(event.target.result);
    };
    reader.readAsDataURL(file);
  };

  const uploadProfilePictureHandler = async (fileInput) => {
    const file = fileInput.files?.[0];
    if (!file || !me?.uid) {
      setUploadError("No file selected or user not authenticated");
      return;
    }

    setProfileLoading(true);
    setUploadError("");
    try {
      // Upload to storage and get public URL
      const publicUrl = await uploadProfilePicture(file, me.uid);

      // Update user profile in database
      await updateUserProfilePicture(me.uid, publicUrl);

      // Update local state
      setUserProfile((prev) => ({
        ...prev,
        profile_picture_url: publicUrl,
      }));

      // Refresh AuthContext so sidebar and header update immediately
      await refreshProfile();

      setPreviewUrl(null);
      setMsg("Profile picture updated successfully!");
      setTimeout(() => setMsg(""), 3000);

      // Reset file input
      fileInput.value = "";
    } catch (err) {
      console.error("Upload error:", err);
      setUploadError(err.message || "Failed to upload profile picture");
    } finally {
      setProfileLoading(false);
    }
  };

  const cancelProfilePictureUpload = () => {
    setPreviewUrl(null);
    setUploadError("");
    const fileInput = document.getElementById("profile-picture-input");
    if (fileInput) fileInput.value = "";
  };

  const removeProfilePicture = async () => {
    if (!me?.uid) return;

    setProfileLoading(true);
    setUploadError("");
    try {
      await deleteProfilePicture(me.uid);
      setUserProfile((prev) => ({
        ...prev,
        profile_picture_url: null,
      }));

      // Refresh AuthContext so sidebar and header update immediately
      await refreshProfile();

      setMsg("Profile picture removed successfully!");
      setTimeout(() => setMsg(""), 3000);
    } catch (err) {
      console.error("Delete error:", err);
      setUploadError(err.message || "Failed to remove profile picture");
    } finally {
      setProfileLoading(false);
    }
  };

  if (me?.role !== "super_admin") {
    return (
      <div className="settings-page">
        <div className="access-denied">
          <h2>🔒 Access Denied</h2>
          <p>Only Super Admins can access global settings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <div className="page-head">
        <div>
          <h1>Global Settings</h1>
          <p>Configure application settings</p>
        </div>
        <button
          className="btn-primary"
          onClick={saveConfig}
          disabled={saving || loading}
        >
          {saving ? "Saving…" : "💾 Save Settings"}
        </button>
      </div>

      {msg && <div className="success-msg">{msg}</div>}
      {uploadError && <div className="error-msg">{uploadError}</div>}

      {/* Profile Picture Settings */}
      <div className="settings-card">
        <h3>Profile Picture</h3>
        <p className="card-desc">Upload and manage your profile picture</p>

        <div className="profile-picture-section">
          <div className="profile-picture-preview-container">
            <div className="profile-picture-current">
              {previewUrl ? (
                <>
                  <img src={previewUrl} alt="Preview" className="preview-img" />
                  <p className="preview-label">New Picture (Preview)</p>
                </>
              ) : (
                <>
                  <ProfilePictureDisplay
                    profilePictureUrl={userProfile?.profile_picture_url}
                    name={userProfile?.name}
                    email={userProfile?.email}
                    size="large"
                  />
                  {userProfile?.profile_picture_url && (
                    <p className="current-label">Current Picture</p>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="profile-picture-controls">
            <div className="upload-input-wrapper">
              <input
                id="profile-picture-input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleProfilePictureChange}
                disabled={profileLoading}
                className="profile-picture-input"
              />
              <label htmlFor="profile-picture-input" className="upload-btn">
                <Upload size={16} />
                Choose Picture
              </label>
            </div>

            {previewUrl && (
              <div className="preview-actions">
                <button
                  className="btn-success"
                  onClick={() => {
                    const fileInput = document.getElementById(
                      "profile-picture-input",
                    );
                    uploadProfilePictureHandler(fileInput);
                  }}
                  disabled={profileLoading}
                >
                  {profileLoading ? "Uploading…" : "✓ Upload"}
                </button>
                <button
                  className="btn-secondary"
                  onClick={cancelProfilePictureUpload}
                  disabled={profileLoading}
                >
                  <X size={16} /> Cancel
                </button>
              </div>
            )}

            {userProfile?.profile_picture_url && !previewUrl && (
              <button
                className="btn-danger"
                onClick={removeProfilePicture}
                disabled={profileLoading}
              >
                {profileLoading ? "Removing…" : "🗑 Remove Picture"}
              </button>
            )}

            <p className="upload-hint">JPG, PNG, or WebP • Max 5MB</p>
          </div>
        </div>
      </div>

      {/* Appearance Settings */}
      <div className="settings-card">
        <h3>Appearance</h3>
        <p className="card-desc">
          Customize the look and feel of your dashboard
        </p>
        <div className="theme-toggle-container">
          <div className="theme-toggle-info">
            <label>Dark Mode</label>
            <p className="toggle-desc">Switch between light and dark theme</p>
          </div>
          <button
            className={`theme-toggle-btn ${darkMode ? "active" : ""}`}
            onClick={toggleDarkMode}
          >
            <div className="toggle-slider">
              {darkMode ? <Moon size={16} /> : <Sun size={16} />}
            </div>
            <span>{darkMode ? "Dark" : "Light"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
