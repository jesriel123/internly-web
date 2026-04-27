import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "../supabaseConfig";
import { writeAuditLog } from "../utils/auditLogger";
import { logAuthEvent } from "../utils/debugLogger";

const AuthContext = createContext(null);
const AUTH_TIMEOUT_MS = 12000;
const PASSWORD_RESET_PROD_URL =
  "https://internll-projects.vercel.app/reset-password";

function sanitizeHttpRedirectUrl(rawValue, fallback) {
  const cleaned = String(rawValue || "").trim();
  if (!cleaned) return fallback;

  try {
    const parsed = new URL(cleaned);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return fallback;
    }
    return parsed.toString();
  } catch {
    return fallback;
  }
}

function timeoutError(label, ms) {
  return new Error(
    `${label} timed out after ${Math.round(ms / 1000)}s. Please try again.`,
  );
}

async function withTimeout(promise, label, ms = AUTH_TIMEOUT_MS) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(timeoutError(label, ms)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = async (authUser) => {
    const { data, error } = await withTimeout(
      supabase
        .from("users")
        .select("*, profile_picture_url")
        .eq("id", authUser.id)
        .maybeSingle(),
      "Loading user profile",
    );
    if (error) throw error;
    if (!data) return null;
    if (data.role !== "admin" && data.role !== "super_admin") return null;
    return {
      uid: data.id,
      email: data.email,
      name: data.name || authUser.email,
      role: data.role,
      company: data.company || "",
      studentId: data.student_id || "",
      program: data.program || "",
      profilePictureUrl: data.profile_picture_url || null,
    };
  };

  useEffect(() => {
    let mounted = true;

    const syncFromSession = async (session, source) => {
      if (!mounted) return;

      if (!session?.user) {
        logAuthEvent(source, null);
        setUser(null);
        setLoading(false);
        return;
      }

      logAuthEvent(source, session.user.email);

      try {
        const profile = await fetchUserProfile(session.user);
        if (!mounted) return;

        // Keep strict access control for non-admin sessions.
        if (!profile) {
          setUser(null);
          return;
        }

        setUser(profile);
      } catch (e) {
        // Avoid forcing logout for transient network/profile fetch issues.
        console.error("[AUTH] profile sync warning:", e);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => syncFromSession(session, "GET_SESSION"))
      .catch((e) => {
        console.error("[AUTH] getSession error:", e);
        if (mounted) setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Avoid async work directly in callback.
      setTimeout(() => {
        if (!mounted) return;

        if (event === "SIGNED_OUT") {
          logAuthEvent(event, null);
          setUser(null);
          setLoading(false);
          return;
        }

        syncFromSession(session, event);
      }, 0);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email, password) => {
    const { data, error } = await withTimeout(
      supabase.auth.signInWithPassword({ email, password }),
      "Signing in",
    );
    if (error) throw error;
    if (!data?.user) {
      throw new Error("Login failed. No user was returned by Supabase.");
    }

    const profile = await fetchUserProfile(data.user);
    if (!profile) {
      await withTimeout(
        supabase.auth.signOut(),
        "Signing out blocked account",
        5000,
      ).catch(() => {});
      throw new Error("Access denied. Admin or Super Admin role required.");
    }

    // Set auth user immediately to avoid waiting on auth state callback.
    setUser(profile);
    setLoading(false);

    withTimeout(
      writeAuditLog(
        {
          uid: data.user.id,
          email: data.user.email,
          name: profile.name,
          role: profile.role,
        },
        "LOGIN",
        `User logged in: ${data.user.email}`,
      ),
      "Writing login audit log",
      5000,
    ).catch((e) => {
      console.error("[AUTH] audit log warning:", e);
    });

    return data.user;
  };

  const forgotPassword = async (email, redirectTo) => {
    const cleanEmail = String(email || "")
      .trim()
      .toLowerCase();
    if (!cleanEmail) {
      throw new Error("Email is required.");
    }

    const safeRedirect = sanitizeHttpRedirectUrl(
      redirectTo,
      PASSWORD_RESET_PROD_URL,
    );

    console.info("[AUTH] Reset redirect:", safeRedirect);

    const { error } = await withTimeout(
      supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: safeRedirect,
      }),
      "Sending password reset email",
    );
    if (error) throw error;
  };

  const logoutUser = async () => {
    if (user) {
      withTimeout(
        writeAuditLog(
          {
            uid: user.uid,
            email: user.email,
            name: user.name,
            role: user.role,
          },
          "LOGOUT",
          `User logged out: ${user.email}`,
        ),
        "Writing logout audit log",
        5000,
      ).catch((e) => {
        console.error("[AUTH] logout audit log warning:", e);
      });
    }

    await withTimeout(supabase.auth.signOut(), "Signing out", 8000);
    setUser(null);
  };

  const refreshProfile = async () => {
    if (!user?.uid) return;
    try {
      const { data, error } = await supabase
        .from("users")
        .select("*, profile_picture_url")
        .eq("id", user.uid)
        .maybeSingle();
      if (error) throw error;
      if (!data) return;
      setUser((prev) => ({
        ...prev,
        profilePictureUrl: data.profile_picture_url || null,
        name: data.name || prev.name,
      }));
    } catch (e) {
      console.error("[AUTH] refreshProfile error:", e);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout: logoutUser,
        forgotPassword,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
