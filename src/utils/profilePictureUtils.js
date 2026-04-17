import { supabase } from "../supabaseConfig";

const BUCKET_NAME = "profile-pictures";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_FORMATS = ["image/jpeg", "image/png", "image/webp"];

/**
 * Validates a file before upload
 * @param {File} file - The file to validate
 * @returns {Object} - { valid: boolean, error?: string }
 */
export const validateImage = (file) => {
  if (!file) {
    return { valid: false, error: "No file selected" };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size must be less than 5MB (current: ${(file.size / 1024 / 1024).toFixed(2)}MB)`,
    };
  }

  if (!ALLOWED_FORMATS.includes(file.type)) {
    return {
      valid: false,
      error: "Only JPG, PNG, and WebP formats are allowed",
    };
  }

  return { valid: true };
};

/**
 * Uploads a profile picture to Supabase storage
 * @param {File} file - The file to upload
 * @param {string} userId - The user ID
 * @returns {Promise<string>} - The public URL of the uploaded image
 */
export const uploadProfilePicture = async (file, userId) => {
  const validation = validateImage(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  if (!userId) {
    throw new Error("User ID is required");
  }

  try {
    // Delete old profile picture if it exists
    try {
      const { data: files } = await supabase.storage
        .from(BUCKET_NAME)
        .list(userId);

      if (files && files.length > 0) {
        const filesToDelete = files.map((f) => `${userId}/${f.name}`);
        await supabase.storage.from(BUCKET_NAME).remove(filesToDelete);
      }
    } catch (err) {
      // It's okay if deletion fails (folder might not exist yet)
      console.warn("Could not delete old profile picture:", err);
    }

    // Determine file extension based on MIME type
    let fileExtension = "jpg";
    if (file.type === "image/png") {
      fileExtension = "png";
    } else if (file.type === "image/webp") {
      fileExtension = "webp";
    }

    const filePath = `${userId}/profile.${fileExtension}`;

    // Upload new file
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // Get public URL
    const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);

    if (!data?.publicUrl) {
      throw new Error("Failed to generate public URL");
    }

    return data.publicUrl;
  } catch (err) {
    throw new Error(`Failed to upload profile picture: ${err.message}`);
  }
};

/**
 * Updates the user's profile picture URL in the database
 * @param {string} userId - The user ID
 * @param {string} profilePictureUrl - The public URL of the profile picture
 */
export const updateUserProfilePicture = async (userId, profilePictureUrl) => {
  if (!userId) {
    throw new Error("User ID is required");
  }

  const { error } = await supabase
    .from("users")
    .update({ profile_picture_url: profilePictureUrl })
    .eq("id", userId);

  if (error) {
    throw new Error(`Failed to update profile picture URL: ${error.message}`);
  }
};

/**
 * Deletes a profile picture from storage and clears the database reference
 * @param {string} userId - The user ID
 */
export const deleteProfilePicture = async (userId) => {
  if (!userId) {
    throw new Error("User ID is required");
  }

  try {
    // Delete from storage
    try {
      const { data: files } = await supabase.storage
        .from(BUCKET_NAME)
        .list(userId);

      if (files && files.length > 0) {
        const filesToDelete = files.map((f) => `${userId}/${f.name}`);
        await supabase.storage.from(BUCKET_NAME).remove(filesToDelete);
      }
    } catch (err) {
      console.warn(
        `Failed to delete profile picture from storage: ${err.message}`,
      );
    }

    // Clear the database reference
    const { error: updateError } = await supabase
      .from("users")
      .update({ profile_picture_url: null })
      .eq("id", userId);

    if (updateError) {
      throw new Error(
        `Failed to clear profile picture URL: ${updateError.message}`,
      );
    }
  } catch (err) {
    throw new Error(`Failed to delete profile picture: ${err.message}`);
  }
};

/**
 * Gets initials from a name or email
 * @param {string} name - User's full name
 * @param {string} email - User's email
 * @returns {string} - The initials (1-2 characters)
 */
export const getInitials = (name, email) => {
  if (name) {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0]?.[0]?.toUpperCase() || "A";
  }
  if (email) {
    return email.charAt(0).toUpperCase();
  }
  return "A";
};
