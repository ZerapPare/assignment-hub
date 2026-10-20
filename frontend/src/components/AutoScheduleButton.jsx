import { useState } from "react";
import axios from "axios";

export default function AutoScheduleButton({
  disabled = false,
  onActionStart,
  onBeforeGenerate,
  onGenerated,
}) {
  const [loading, setLoading] = useState(false);

  // บันทึกค่าที่ผู้ใช้ตั้งไว้ก่อน แล้วจึงขอให้ backend สร้างตาราง
  const handleClick = async () => {
    if (disabled || loading) return;

    setLoading(true);
    onActionStart?.();
    try {
      if (onBeforeGenerate) {
        const saved = await onBeforeGenerate();
        // หากบันทึกไม่ผ่าน ให้หยุดก่อนส่งคำขอจัดตาราง
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
      // คืนสถานะปุ่มให้กดได้หลังคำขอจบไม่ว่าผลจะสำเร็จหรือไม่
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
          ? "กรุณาแก้ไขระยะเวลางานที่ไม่ถูกต้องก่อนจัดตาราง"
          : "จัดตารางอัตโนมัติ"
      }
      style={disabled ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
    >
      {loading ? "กำลังจัดตาราง..." : "จัดตารางอัตโนมัติ"}
    </button>
  );
}
