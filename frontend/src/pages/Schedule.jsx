import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

import Sidebar from "../components/Sidebar";
import TaskList from "../components/TaskList";
import LunchTimeSetting, {
  isValidLunchTimeRange,
} from "../components/LunchTimeSetting";
import AutoScheduleButton from "../components/AutoScheduleButton";
import AdPopup from "../components/AdPopup";
import { fetchRandomAdvertisement } from "../ads";
import { GridIcon } from "../icons";
import useAssignments from "../useAssignments";

import "./Schedule.css";

export default function Schedule() {
  const navigate = useNavigate();
  const { student, logout } = useAssignments();

  // เก็บรายการงาน ค่าตั้งเวลา และสถานะการตรวจสอบที่ส่งต่อให้ component ลูก
  const [assignments, setAssignments] = useState([]);
  const [scheduleSettings, setScheduleSettings] = useState(null);
  const [taskDurations, setTaskDurations] = useState({});
  const [toast, setToast] = useState(null);
  const [ad, setAd] = useState(null);
  const [showAd, setShowAd] = useState(false);

  const showRandomAd = async () => {
    try {
      const selectedAd = await fetchRandomAdvertisement();
      setAd(selectedAd);
      setShowAd(Boolean(selectedAd));
    } catch (err) {
      console.error("Advertisement request failed:", err);
    }
  };

  const [taskValidity, setTaskValidity] = useState({
    hasInvalid: false,
    invalidTasks: [],
    hasOverLimit: false,
    overLimitTasks: [],
  });

  // State สำหรับควบคุม Problem Tasks Modal
  const [problemModal, setProblemModal] = useState({
    open: false,
    title: "",
    type: "late", // 'late' หรือ 'invalid'
    tasks: [],
  });

  const load = async () => {
    try {
      const { data } = await axios.get("/api/assignments?filter=active");
      setAssignments(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Load failed:", err);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // ฟังก์ชันเปิด Modal งานส่งไม่ทัน
  const showLateTasksModal = (lateTasks) => {
    setProblemModal({
      open: true,
      title: "ตรวจพบงานที่จะส่งไม่ทัน",
      type: "late",
      tasks: lateTasks,
    });
  };

  // ฟังก์ชันเปิด Modal งานที่ไม่ถูกต้อง (0 นาที)
  const showInvalidTasksModal = (invalidTaskNames) => {
    setProblemModal({
      open: true,
      title: "ไม่สามารถจัดตารางได้",
      type: "invalid",
      tasks: invalidTaskNames,
    });
  };

  const showToast = (message, type = "success", detail = null) => {
    setToast({ message, type, detail });
    setTimeout(() => setToast(null), 4500);
  };

  // 1. ปรับฟังก์ชัน handleGenerated ให้แสดง Toast แจ้งสำเร็จแม้จะมี lateTasks
  const handleGenerated = (result) => {
    load();
    if (result?.error) {
      showToast(result.message, "error");
      return;
    }

    // แสดง Toast แจ้งจำนวนงานที่จัดสำเร็จเสมอ
    showToast(
      `บันทึกและจัดตารางสำเร็จ (${result?.scheduled || 0}/${result?.total || 0} งาน)`,
      "success",
    );

    // หากมี lateTasks ให้เปิด Modal แสดงรายการเพิ่มเติม
    if (result?.lateTasks?.length > 0) {
      showLateTasksModal(result.lateTasks);
    }
  };

  const handleSettingsChange = useCallback((settings) => {
    setScheduleSettings(settings);
  }, []);

  const handleDurationsChange = useCallback((durations) => {
    setTaskDurations(durations);
  }, []);

  const handleValidityChange = useCallback((validity) => {
    setTaskValidity(validity);
  }, []);

  const hasInvalidLunchRange = Boolean(
    scheduleSettings?.lunch?.enabled &&
    !isValidLunchTimeRange(
      scheduleSettings.lunch.lunch_start,
      scheduleSettings.lunch.lunch_end,
    ),
  );

  const saveAll = async () => {
    if (taskValidity.hasOverLimit) {
      showToast("ระยะเวลางานต้องไม่เกิน 168 ชั่วโมง", "error");
      return false;
    }

    // ตรวจสอบงานที่ระยะเวลาเป็น 0 นาที
    if (taskValidity.hasInvalid) {
      showInvalidTasksModal(taskValidity.invalidTasks);
      return false;
    }

    try {
      const requests = [];

      if (scheduleSettings) {
        const { workingHours, lunch } = scheduleSettings;
        if (
          lunch.enabled &&
          !isValidLunchTimeRange(lunch.lunch_start, lunch.lunch_end)
        ) {
          showToast(
            "ช่วงเวลาพักไม่ถูกต้อง: เวลาเริ่มพักต้องก่อนเวลาสิ้นสุด",
            "error",
          );
          return false;
        }

        const workingHoursPayload = {};

        // บันทึกเฉพาะวันที่เปิดทำงาน และเก็บเวลาพักเป็น null เมื่อปิดสวิตช์
        for (let d = 0; d < 7; d++) {
          if (workingHours[d]) {
            workingHoursPayload[String(d)] = `${workingHours[d]}:00`;
          }
        }

        requests.push(
          axios.put("/api/user/working-hours", workingHoursPayload),
        );

        requests.push(
          axios.put("/api/user/settings", {
            lunch_start: lunch.enabled ? `${lunch.lunch_start}:00` : null,
            lunch_end: lunch.enabled ? `${lunch.lunch_end}:00` : null,
          }),
        );
      }

      assignments.forEach((task) => {
        const duration = taskDurations[task.assignment_id];
        if (!duration) return;
        const total = duration.hours * 60 + duration.minutes;
        requests.push(
          axios.patch(`/api/tasks/${task.assignment_id}/duration`, {
            time_estimate: total,
          }),
        );
      });

      await Promise.all(requests);
      await load();
      return true;
    } catch (err) {
      console.error("Save failed:", err);
      showToast(
        "บันทึกไม่สำเร็จ: " + (err.response?.data?.error || err.message),
        "error",
      );
      return false;
    }
  };

  return (
    <div className="schedule-page">
      <Sidebar active="schedule" student={student} onLogout={logout} />

      <main className="schedule-main">
        {/* ============ HEADER ============ */}
        <header className="schedule-header">
          <div>
            <h1>ระบบจัดตาราง</h1>
            <p>ตั้งเวลาทำงาน กำหนดเวลาที่ใช้กับงาน และจัดตารางงานอัตโนมัติ</p>
          </div>

          <div className="schedule-header-actions">
            <AutoScheduleButton
              disabled={
                taskValidity.hasInvalid ||
                taskValidity.hasOverLimit ||
                hasInvalidLunchRange
              }
              onActionStart={showRandomAd}
              onBeforeGenerate={saveAll}
              onGenerated={handleGenerated}
            />

            <button
              className="weekly-button"
              onClick={() => navigate("/weekly")}
            >
              <GridIcon size={16} color="#fff" />
              ดูตารางรายสัปดาห์
            </button>
          </div>
        </header>

        {/* ตั้งวัน/เวลาเริ่มทำงานและช่วงพัก */}
        <section className="schedule-card">
          <LunchTimeSetting onChange={handleSettingsChange} />
        </section>

        {/* กรอกระยะเวลาที่คาดว่าจะใช้ของแต่ละงาน */}
        <section className="schedule-card">
          <TaskList
            assignments={assignments}
            onUpdated={load}
            onDurationsChange={handleDurationsChange}
            onValidityChange={handleValidityChange}
          />
        </section>
      </main>

      <AdPopup ad={ad} open={showAd} onClose={() => setShowAd(false)} />

      {/* ============ PROBLEM TASKS MODAL ============ */}
      {problemModal.open && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <div className="modal-header-title">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#dc2626"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <h3>{problemModal.title}</h3>
              </div>
              <button
                className="modal-close-btn"
                onClick={() =>
                  setProblemModal({ ...problemModal, open: false })
                }
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              {problemModal.type === "late" ? (
                <>
                  <p className="modal-description">
                    มีทั้งหมด <strong>{problemModal.tasks.length} งาน</strong>{" "}
                    ที่ไม่สามารถจัดลงตารางได้ทันกำหนดส่ง:
                  </p>
                  <ul className="problem-task-list">
                    {problemModal.tasks.map((task, index) => (
                      <li
                        key={task.assignment_id || index}
                        className="problem-task-item late-item"
                      >
                        <div className="task-main-info">
                          <span className="task-title" title={task.title}>
                            {task.title}
                          </span>
                        </div>
                        {task.due_date && (
                          <div className="task-due-badge">
                            <span className="due-label">กำหนดส่ง</span>
                            <span className="due-date">
                              {new Date(task.due_date).toLocaleDateString(
                                "th-TH",
                                {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                },
                              )}
                            </span>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <>
                  <p className="modal-description">
                    กรุณาระบุระยะเวลาทำงานให้มากกว่า 0 นาที สำหรับงานต่อไปนี้:
                  </p>
                  <ul className="problem-task-list">
                    {problemModal.tasks.map((name, index) => (
                      <li
                        key={index}
                        className="problem-task-item invalid-item"
                      >
                        <span className="task-title">{name}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            <div className="modal-footer">
              <button
                className="btn-primary"
                onClick={() =>
                  setProblemModal({ ...problemModal, open: false })
                }
              >
                เข้าใจแล้ว
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ TOAST ============ */}
      {toast && (
        <div
          className={`schedule-toast ${
            toast.type === "error" ? "toast-error" : "toast-success"
          }`}
        >
          <span>{toast.type === "error" ? "✕" : "✓"}</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div>{toast.message}</div>
            {toast.detail && (
              <div style={{ fontSize: 12, opacity: 0.9, fontWeight: 500 }}>
                {toast.detail}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
