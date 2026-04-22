import React from 'react';
import './ProfilePictureDisplay.css';

/**
 * Reusable component to display a profile picture with fallback to initials
 * @param {string} profilePictureUrl - The URL of the profile picture
 * @param {string} name - The user's name for generating initials
 * @param {string} email - The user's email for fallback initials
 * @param {number} size - The size of the avatar in pixels (default: 40)
 * @param {string} className - Additional CSS classes
 */
export default function ProfilePictureDisplay({
  profilePictureUrl,
  name,
  email,
  size = 40,
  className = '',
}) {
  const sizeMap = {
    small: 32,
    medium: 40,
    large: 96,
  };

  const normalizedSize =
    typeof size === 'number'
      ? size
      : sizeMap[String(size || '').toLowerCase()] || 40;

  const getInitials = () => {
    if (name) {
      const parts = name.trim().split(' ');
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return parts[0][0]?.toUpperCase() || 'A';
    }
    if (email) {
      return email.charAt(0).toUpperCase();
    }
    return 'A';
  };

  const initials = getInitials();

  if (profilePictureUrl) {
    return (
      <div
        className={`profile-picture ${className}`}
        style={{ width: normalizedSize, height: normalizedSize }}
      >
        <img
          src={profilePictureUrl}
          alt={name || email || 'Profile'}
          className="profile-picture-img"
          onError={(e) => {
            e.target.style.display = 'none';
            const fallback = e.target.nextElementSibling;
            if (fallback) fallback.style.display = 'flex';
          }}
        />
        <div className="profile-picture-fallback" style={{ display: 'none' }}>
          {initials}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`profile-picture ${className}`}
      style={{ width: normalizedSize, height: normalizedSize }}
    >
      <div className="profile-picture-fallback">{initials}</div>
    </div>
  );
}
