import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseConfig";
import { useAuth } from "../context/AuthContext";
import { writeAuditLog } from "../utils/auditLogger";
import { createApprovalNotification } from "../utils/notificationHelper";
import "./TimeLogsPage.css";

function fmtTime(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function autoClassify(hours, dailyMax) {
  if (hours == null) return null;
  const h = Number(hours);
  if (h > dailyMax) return "overtime";
  if (h >= dailyMax) return "present";
  if (h >= dailyMax / 2) return "earlyOut";
  return "halfDay";
}

const TYPE_LABELS = {
  present: { label: "Present", color: "#7C3AED", bg: "#EDE9FE" },
  overtime: { label: "OT", color: "#10B981", bg: "#D1FAE5" },
  earlyOut: { label: "Early Out", color: "#3B82F6", bg: "#DBEAFE" },
  halfDay: { label: "Half Day", color: "#F59E0B", bg: "#FEF3C7" },
};

export default function TimeLogsPage() {
  const { user: me } = useAuth();
  const [students, setStudents] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);

  const normalizeStudent = (row) => {
    const role = String(row?.role || "user").toLowerCase();
    if (role === "admin" || role === "super_admin") return null;

    const setup = row?.setup && typeof row.setup === "object" ? row.setup : {};
    const requiredHours = Number(
      setup.requiredHours ??
        setup.required_hours ??
        row?.required_hours ??
        row?.requiredHours ??
        486,
    );
    const dailyMaxHours = Number(
      setup.dailyMaxHours ??
        setup.daily_max_hours ??
        row?.daily_max_hours ??
        row?.dailyMaxHours ??
        8,
    );

    return {
      ...row,
      setup: {
        requiredHours: Number.isFinite(requiredHours) ? requiredHours : 486,
        dailyMaxHours: Number.isFinite(dailyMaxHours) ? dailyMaxHours : 8,
      },
    };
  };

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const { data: list, error } = await supabase
        .from("users")
        .select("*")
        .limit(500);
      if (error) throw error;

      const fromUsers = (list || [])
        .map(normalizeStudent)
        .filter(Boolean)
        .sort((a, b) =>
          String(a.name || a.email || "").localeCompare(
            String(b.name || b.email || ""),
          ),
        );

      if (fromUsers.length > 0) {
        setStudents(fromUsers);
        return;
      }

      // Fallback: if no student profiles are returned, derive selectable students from time_logs user_id.
      const { data: logRows, error: logsError } = await supabase
        .from("time_logs")
        .select("user_id,date")
        .order("date", { ascending: false })
        .limit(500);
      if (logsError) throw logsError;

      const ids = Array.from(
        new Set((logRows || []).map((r) => r.user_id).filter(Boolean)),
      );
      if (ids.length === 0) {
        setStudents([]);
        return;
      }

      const nameById = {};
      const { data: auditRows } = await supabase
        .from("audit_logs")
        .select("user_id,user_name,created_at")
        .in("user_id", ids)
        .order("created_at", { ascending: false })
        .limit(1000);

      (auditRows || []).forEach((r) => {
        if (!nameById[r.user_id] && r.user_name) {
          nameById[r.user_id] = r.user_name;
        }
      });

      const derived = ids.map((id) => ({
        id,
        name: nameById[id] || `User ${id.slice(0, 8)}`,
        email: "",
        company: "—",
        setup: { requiredHours: 486, dailyMaxHours: 8 },
      }));

      setStudents(derived);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const fetchCompanyLogs = useCallback(
    async (companyName) => {
      const normalizedCompany = String(companyName || "").trim();
      if (!normalizedCompany) {
        setLogs([]);
        return;
      }

      const companyStudents = students.filter(
        (s) => String(s.company || "").trim() === normalizedCompany,
      );
      const studentIds = companyStudents.map((s) => s.id).filter(Boolean);

      if (studentIds.length === 0) {
        setLogs([]);
        return;
      }

      setLogsLoading(true);
      try {
        const { data: list, error } = await supabase
          .from("time_logs")
          .select("*")
          .in("user_id", studentIds)
          .order("date", { ascending: false })
          .limit(2000);
        if (error) throw error;
        const mapped = (list || []).map((d) => ({
          ...d,
          id: d.id,
          uid: d.user_id,
          timeIn: d.time_in ?? d.timeIn,
          timeOut: d.time_out ?? d.timeOut,
          logType: d.log_type ?? d.logType,
        }));

        mapped.sort((a, b) => {
          const byDate = String(b.date || "").localeCompare(
            String(a.date || ""),
          );
          if (byDate !== 0) return byDate;
          const at = new Date(a.timeIn || 0).getTime();
          const bt = new Date(b.timeIn || 0).getTime();
          return bt - at;
        });

        setLogs(mapped);
      } catch (err) {
        console.error(err);
        setLogs([]);
      } finally {
        setLogsLoading(false);
      }
    },
    [students],
  );

  const handleCompanyChange = (companyName) => {
    setSelectedCompany(companyName);
    setStudentSearch("");
    if (!companyName) {
      setLogs([]);
    }
  };

  const updateLogStatus = async (log, status, logType = null) => {
    try {
      const update = { status };
      if (logType) update.log_type = logType;
      const { error } = await supabase
        .from("time_logs")
        .update(update)
        .eq("id", log.id);
      if (error) throw error;
      setLogs((prev) =>
        prev.map((l) =>
          l.id === log.id
            ? { ...l, status, ...(logType ? { logType } : {}) }
            : l,
        ),
      );
      const studentName =
        students.find((s) => s.id === log.uid)?.name || log.uid;
      const studentCompany =
        students.find((s) => s.id === log.uid)?.company || '';
      const hrs =
        log.hours != null ? `${Number(log.hours).toFixed(2)}h` : "N/A";
      const typeLabel = logType
        ? ` [${TYPE_LABELS[logType]?.label || logType}]`
        : "";
      await writeAuditLog(
        me,
        `${status.toUpperCase()}_TIME_LOG`,
        `${status.charAt(0).toUpperCase() + status.slice(1)} time log for ${studentName} on ${log.date} (${hrs})${typeLabel}`,
      );

      // Create notification for super_admins when admin approves/rejects
      if (status === 'approved' || status === 'rejected') {
        await createApprovalNotification({
          adminId: me.uid,
          adminName: me.name || me.email,
          adminRole: me.role,
          action: status,
          studentId: log.uid,
          studentName,
          studentCompany,
          logDate: log.date,
          logId: log.id,
          hours: hrs,
          logType: logType || log.logType,
        });
      }
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const flagLog = async (log) => {
    try {
      const { error } = await supabase
        .from("time_logs")
        .update({ status: "flagged" })
        .eq("id", log.id);
      if (error) throw error;
      setLogs((prev) =>
        prev.map((l) => (l.id === log.id ? { ...l, status: "flagged" } : l)),
      );
      const studentName =
        students.find((s) => s.id === log.uid)?.name || log.uid;
      await writeAuditLog(
        me,
        "FLAG_TIME_LOG",
        `Flagged time log for ${studentName} on ${log.date}`,
      );
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const deleteLog = async (log) => {
    if (!window.confirm("Remove this log entry?")) return;
    try {
      const { error } = await supabase
        .from("time_logs")
        .delete()
        .eq("id", log.id);
      if (error) throw error;
      setLogs((prev) => prev.filter((l) => l.id !== log.id));
      const studentName =
        students.find((s) => s.id === log.uid)?.name || log.uid;
      await writeAuditLog(
        me,
        "DELETE_TIME_LOG",
        `Deleted time log for ${studentName} on ${log.date}`,
      );
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const companyOptions = Array.from(
    new Set(
      students.map((s) => String(s.company || "").trim()).filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b));

  const studentById = students.reduce((acc, s) => {
    acc[s.id] = s;
    return acc;
  }, {});

  const companyStudents = students.filter(
    (s) => String(s.company || "").trim() === selectedCompany,
  );

  const searchQuery = studentSearch.trim().toLowerCase();

  const visibleLogs = logs.filter((l) => {
    if (!searchQuery) return true;
    const s = studentById[l.uid];
    const haystack = `${s?.name || ""} ${s?.email || ""}`.toLowerCase();
    return haystack.includes(searchQuery);
  });

  useEffect(() => {
    if (!selectedCompany) {
      setLogs([]);
      return;
    }
    fetchCompanyLogs(selectedCompany);
  }, [selectedCompany, fetchCompanyLogs]);

  return (
    <div className="timelogs-page">
      <div className="page-head">
        <div>
          <h1>Time Logs</h1>
          <p>View and manage student daily attendance logs</p>
        </div>
        <button
          className="btn-primary"
          onClick={() => {
            fetchStudents();
          }}
          disabled={loading}
        >
          {loading ? "Loading…" : "↻ Refresh"}
        </button>
      </div>

      {/* Company + search */}
      <div className="toolbar">
        <select
          className="company-select"
          value={selectedCompany}
          onChange={(e) => handleCompanyChange(e.target.value)}
        >
          <option value="">— Select a company —</option>
          {companyOptions.map((companyName) => (
            <option key={companyName} value={companyName}>
              {companyName}
            </option>
          ))}
        </select>

        <input
          className="student-search"
          type="text"
          value={studentSearch}
          onChange={(e) => setStudentSearch(e.target.value)}
          placeholder="Search student name"
          disabled={!selectedCompany}
        />

        {selectedCompany && (
          <div className="company-summary">
            {companyStudents.length} student
            {companyStudents.length !== 1 ? "s" : ""} in {selectedCompany}
          </div>
        )}
      </div>

      {/* Logs table */}
      <div className="table-card">
        <h3>Daily Logs {selectedCompany ? `— ${selectedCompany}` : ""}</h3>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Student</th>
              <th>Time In</th>
              <th>Time Out</th>
              <th>Hours</th>
              <th>Type</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleLogs.map((l) => {
              const rowStudent = studentById[l.uid];
              const dailyMax = rowStudent?.setup?.dailyMaxHours || 8;
              const studentName =
                rowStudent?.name || rowStudent?.email || l.uid;
              const detectedType = l.logType || autoClassify(l.hours, dailyMax);
              const typeInfo = detectedType ? TYPE_LABELS[detectedType] : null;
              return (
                <tr key={l.id}>
                  <td className="td-name">{l.date}</td>
                  <td>{studentName}</td>
                  <td>{fmtTime(l.timeIn)}</td>
                  <td>{fmtTime(l.timeOut)}</td>
                  <td>
                    <strong>
                      {l.hours != null ? Number(l.hours).toFixed(2) : "—"}
                    </strong>
                  </td>
                  <td>
                    {typeInfo && (
                      <span
                        className="badge"
                        style={{
                          background: typeInfo.bg,
                          color: typeInfo.color,
                          fontWeight: 700,
                        }}
                      >
                        {typeInfo.label}
                      </span>
                    )}
                  </td>
                  <td>
                    <span className={`badge status-${l.status || "pending"}`}>
                      {(l.status || "pending").toUpperCase()}
                    </span>
                  </td>
                  <td className="td-actions">
                    {!["approved", "rejected", "flagged"].includes(
                      l.status,
                    ) && (
                      <>
                        <button
                          className="action-btn approve-present"
                          onClick={() =>
                            updateLogStatus(l, "approved", "present")
                          }
                        >
                          Present
                        </button>
                        <button
                          className="action-btn approve-ot"
                          onClick={() =>
                            updateLogStatus(l, "approved", "overtime")
                          }
                        >
                          OT
                        </button>
                        <button
                          className="action-btn approve-early"
                          onClick={() =>
                            updateLogStatus(l, "approved", "earlyOut")
                          }
                        >
                          Early Out
                        </button>
                        <button
                          className="action-btn approve-half"
                          onClick={() =>
                            updateLogStatus(l, "approved", "halfDay")
                          }
                        >
                          Half Day
                        </button>
                      </>
                    )}
                    {!["approved", "rejected", "flagged"].includes(
                      l.status,
                    ) && (
                      <button
                        className="action-btn warn"
                        onClick={() => updateLogStatus(l, "rejected")}
                      >
                        Reject
                      </button>
                    )}
                    {!["approved", "rejected", "flagged"].includes(
                      l.status,
                    ) && (
                      <button
                        className="action-btn warn"
                        onClick={() => flagLog(l)}
                      >
                        Flag
                      </button>
                    )}
                    {me?.role === "super_admin" && (
                      <button
                        className="action-btn danger"
                        onClick={() => deleteLog(l)}
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {visibleLogs.length === 0 && !logsLoading && (
              <tr>
                <td
                  colSpan="8"
                  style={{ textAlign: "center", color: "#aaa", padding: 32 }}
                >
                  {!selectedCompany
                    ? "Select a company to view daily logs"
                    : searchQuery
                      ? "No matching logs for that student name in this company"
                      : "No logs found for the selected company"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
