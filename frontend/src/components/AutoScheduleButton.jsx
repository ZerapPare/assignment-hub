import { useState } from "react";
import axios from "axios";

export default function AutoScheduleButton({
  disabled = false,
  onBeforeGenerate,
  onGenerated,
}) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (disabled || loading) return;

    setLoading(true);
    try {
      if (onBeforeGenerate) {
        const saved = await onBeforeGenerate();
        if (saved === false) {
          setLoading(false);
          return;
        }
      }

      const { data } = await axios.post("/api/schedule/generate");
      onGenerated?.(data);
    } catch (err) {
      console.error("Generate failed:", err);
      onGenerated?.({
        error: true,
        message: err.response?.data?.error || err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      className="auto-schedule-button"
      onClick={handleClick}
      disabled={disabled || loading}
      title={
        disabled
          ? "มีงานที่ระยะเวลาเป็น 0 — กรุณาแก้ไขก่อนจัดตาราง"
          : "จัดตารางอัตโนมัติ"
      }
      style={disabled ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
    >
      {loading ? "กำลังจัดตาราง..." : "จัดตารางอัตโนมัติ"}
    </button>
  );
}
