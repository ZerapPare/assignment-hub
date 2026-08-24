import React, { useEffect, useMemo, useState } from 'react';
import Toggle from './Toggle';
import { BellIcon } from '../icons';
import { C, FONT, R, TH_MONTHS_SHORT } from '../theme';

// Minutes, matching what the API stores. Presets and custom values share one
// representation so nothing has to carry a unit around.
const PRESETS = [60, 180, 1440, 4320];

const UNITS = [
  { value: 1, label: 'นาที' },
  { value: 60, label: 'ชั่วโมง' },
  { value: 1440, label: 'วัน' },
];

const MAX_LEAD_MINUTES = 40320; // 28 days — same ceiling the backend enforces

function formatLeadTime(minutes) {
  if (minutes % 1440 === 0) return `${minutes / 1440} วัน`;
  if (minutes % 60 === 0) return `${minutes / 60} ชั่วโมง`;
  return `${minutes} นาที`;
}

const pad = (n) => String(n).padStart(2, '0');

// Buddhist-era date, the same convention MiniCalendar uses for its header.
function formatThaiDateTime(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return (
    `${d.getDate()} ${TH_MONTHS_SHORT[d.getMonth()]} ${d.getFullYear() + 543} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

// One string per settings state, so "has anything changed?" is a comparison
// rather than a field-by-field diff. lastCustom counts: typing a custom value
// that happens to be selected already changes nothing else, but still needs
// saving so the hint line remembers it.
const snapshot = (s) =>
  JSON.stringify([
    s.enabled,
    [...s.leadTimes].sort((a, b) => a - b),
    s.dailyRepeat,
    s.dailyRepeatTime,
    s.lastCustom ?? null,
  ]);

function NotificationSettings({ email }) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [enabled, setEnabled] = useState(true);
  const [leadTimes, setLeadTimes] = useState([]);
  const [dailyRepeat, setDailyRepeat] = useState(false);
  const [dailyRepeatTime, setDailyRepeatTime] = useState('08:00');
  const [lastCustom, setLastCustom] = useState(null);
  const [failures, setFailures] = useState({ failed_count: 0, last_failed_at: null });

  const [saved, setSaved] = useState(null); // snapshot string of the stored state
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [justSaved, setJustSaved] = useState(false);

  const [customOpen, setCustomOpen] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const [customUnit, setCustomUnit] = useState(60);
  const [customError, setCustomError] = useState(null);

  const apply = (data) => {
    setEnabled(data.enabled);
    setLeadTimes(data.lead_times);
    setDailyRepeat(data.daily_repeat);
    setDailyRepeatTime(data.daily_repeat_time);
    setLastCustom(data.last_custom_minutes);
    setFailures({
      failed_count: data.failed_count ?? 0,
      last_failed_at: data.last_failed_at ?? null,
    });
    setSaved(
      snapshot({
        enabled: data.enabled,
        leadTimes: data.lead_times,
        dailyRepeat: data.daily_repeat,
        dailyRepeatTime: data.daily_repeat_time,
        lastCustom: data.last_custom_minutes,
      })
    );
  };

  useEffect(() => {
    fetch('/api/notification-settings')
      .then((r) => {
        if (!r.ok) throw new Error('โหลดการตั้งค่าการแจ้งเตือนไม่สำเร็จ');
        return r.json();
      })
      .then(apply)
      .catch((e) => setLoadError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const current = snapshot({ enabled, leadTimes, dailyRepeat, dailyRepeatTime, lastCustom });
  const dirty = saved !== null && current !== saved;

  // Any edit invalidates the "saved" note, the same way the student-id form
  // clears its confirmation as soon as the field is touched.
  const edit = (fn) => (...args) => {
    setJustSaved(false);
    setSaveError(null);
    fn(...args);
  };

  const toggleLead = edit((minutes) => {
    setLeadTimes((prev) =>
      prev.includes(minutes) ? prev.filter((m) => m !== minutes) : [...prev, minutes]
    );
  });

  // Presets plus whatever custom values are selected, so a custom choice is
  // visible as a chip and can be removed the same way.
  const chips = useMemo(() => {
    const extra = leadTimes.filter((m) => !PRESETS.includes(m));
    return [...PRESETS, ...extra.sort((a, b) => a - b)];
  }, [leadTimes]);

  const addCustom = () => {
    const minutes = Number(customValue) * customUnit;
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > MAX_LEAD_MINUTES) {
      setCustomError('ใส่ได้ตั้งแต่ 1 นาที ถึง 28 วัน');
      return;
    }
    setCustomError(null);
    setJustSaved(false);
    setSaveError(null);
    setLeadTimes((prev) => (prev.includes(minutes) ? prev : [...prev, minutes]));
    setLastCustom(minutes);
    setCustomValue('');
    setCustomOpen(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    setJustSaved(false);
    try {
      const r = await fetch('/api/notification-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled,
          lead_times: leadTimes,
          daily_repeat: dailyRepeat,
          daily_repeat_time: dailyRepeatTime,
          last_custom_minutes: lastCustom,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'บันทึกไม่สำเร็จ');
      apply(data);
      setJustSaved(true);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Everything below the master switch dims and stops responding when
  // notifications are off — the switch still saves, so the settings survive.
  const off = !enabled;
  const bodyStyle = { ...styles.body, opacity: off ? 0.5 : 1 };

  return (
    <div style={styles.card}>
      <div style={styles.head}>
        <span style={styles.headIcon}>
          <BellIcon size={17} color={C.pink} />
        </span>
        <div style={styles.headText}>
          <div style={styles.cardTitle}>การแจ้งเตือน</div>
          <div style={styles.subtitle}>
            แจ้งเตือนก่อนถึงกำหนดส่งงาน ผ่านอีเมล{email ? ` ${email}` : 'ของบัญชีที่เข้าสู่ระบบ'}
          </div>
        </div>
        <Toggle
          checked={enabled}
          onChange={edit(setEnabled)}
          disabled={loading || !!loadError}
          label="เปิดการแจ้งเตือน"
        />
      </div>

      {loading && <p style={styles.muted}>กำลังโหลด…</p>}
      {loadError && <p style={styles.error}>⚠️ {loadError}</p>}

      {!loading && !loadError && (
        <div style={bodyStyle}>
          <div style={styles.section}>
            <div style={styles.sectionTitle}>แจ้งเตือนล่วงหน้าก่อนกำหนดส่ง</div>

            <div style={styles.chipRow}>
              {chips.map((minutes) => {
                const on = leadTimes.includes(minutes);
                return (
                  <button
                    key={minutes}
                    type="button"
                    disabled={off}
                    onClick={() => toggleLead(minutes)}
                    aria-pressed={on}
                    style={{
                      ...styles.chip,
                      ...(on ? styles.chipOn : null),
                      cursor: off ? 'default' : 'pointer',
                    }}
                  >
                    {formatLeadTime(minutes)}
                  </button>
                );
              })}

              <button
                type="button"
                disabled={off}
                onClick={() => {
                  setCustomOpen((v) => !v);
                  setCustomError(null);
                }}
                style={{ ...styles.chip, ...styles.chipCustom, cursor: off ? 'default' : 'pointer' }}
              >
                + กำหนดเอง
              </button>
            </div>

            {customOpen && !off && (
              <div style={styles.customRow}>
                <input
                  type="number"
                  min="1"
                  value={customValue}
                  onChange={(e) => setCustomValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCustom();
                    }
                  }}
                  placeholder="เช่น 12"
                  style={{ ...styles.input, width: 96 }}
                />
                <select
                  value={customUnit}
                  onChange={(e) => setCustomUnit(Number(e.target.value))}
                  style={{ ...styles.input, width: 104 }}
                >
                  {UNITS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={addCustom} style={styles.ghostBtn}>
                  เพิ่ม
                </button>
              </div>
            )}
            {customError && <p style={styles.error}>⚠️ {customError}</p>}

            <div style={styles.hint}>
              <span>เลือกได้มากกว่า 1 ช่วงเวลา</span>
              {lastCustom !== null && !leadTimes.includes(lastCustom) && (
                <>
                  <span>·</span>
                  <span>ล่าสุดที่กำหนดเอง</span>
                  <button
                    type="button"
                    disabled={off}
                    onClick={() => toggleLead(lastCustom)}
                    style={{ ...styles.hintPill, cursor: off ? 'default' : 'pointer' }}
                  >
                    {formatLeadTime(lastCustom)}
                  </button>
                </>
              )}
            </div>
          </div>

          <div style={styles.repeatBox}>
            <div style={styles.repeatText}>
              <div style={styles.repeatTitle}>แจ้งเตือนซ้ำรายวัน</div>
              <div style={styles.subtitle}>ส่งซ้ำทุกวันสำหรับงานที่ยังไม่เสร็จ จนกว่าจะส่งงาน</div>
            </div>
            <input
              type="time"
              value={dailyRepeatTime}
              disabled={off}
              onChange={edit((e) => setDailyRepeatTime(e.target.value))}
              style={{ ...styles.input, width: 96 }}
            />
            <Toggle
              checked={dailyRepeat}
              onChange={edit(setDailyRepeat)}
              disabled={off}
              label="แจ้งเตือนซ้ำรายวัน"
            />
          </div>

          {failures.failed_count > 0 && (
            <div style={styles.failBox}>
              <div style={styles.failTitle}>⚠️ ส่งอีเมลไม่สำเร็จ {failures.failed_count} รายการ</div>
              <div style={styles.failMeta}>
                ระบบบันทึกข้อผิดพลาดไว้แล้ว
                {failures.last_failed_at && ` · ครั้งล่าสุด ${formatThaiDateTime(failures.last_failed_at)}`}
              </div>
            </div>
          )}

          <div style={styles.actions}>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !dirty}
              style={{ ...styles.primaryBtn, opacity: saving || !dirty ? 0.6 : 1 }}
            >
              {saving ? 'กำลังบันทึก…' : 'บันทึกการตั้งค่า'}
            </button>
            <button
              type="button"
              disabled
              title="ยังไม่ได้ต่อระบบส่งอีเมล"
              style={{ ...styles.ghostBtn, opacity: 0.5, cursor: 'default' }}
            >
              ส่งอีเมลทดสอบ
            </button>
          </div>

          {saveError && <p style={styles.error}>⚠️ {saveError}</p>}
          {justSaved && <p style={styles.success}>บันทึกการตั้งค่าแล้ว</p>}
        </div>
      )}
    </div>
  );
}

const styles = {
  card: { background: C.card, borderRadius: R.card, padding: 22, minWidth: 0 },

  head: { display: 'flex', alignItems: 'flex-start', gap: 10 },
  headIcon: { display: 'flex', paddingTop: 2, flexShrink: 0 },
  headText: { flex: '1 1 auto', minWidth: 0 },
  cardTitle: { fontWeight: 700, fontSize: 15, color: C.ink },
  subtitle: { fontSize: 12.5, color: C.muted, marginTop: 4, overflowWrap: 'anywhere' },

  body: {
    marginTop: 18,
    paddingTop: 18,
    borderTop: `1px solid ${C.lineSoft}`,
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  },

  section: { display: 'flex', flexDirection: 'column', gap: 10 },
  sectionTitle: { fontSize: 13.5, fontWeight: 700, color: C.ink },

  chipRow: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  chip: {
    padding: '8px 16px',
    borderRadius: R.pill,
    border: `1px solid ${C.lineInput}`,
    background: C.card,
    color: C.ink,
    fontFamily: FONT,
    fontWeight: 600,
    fontSize: 13,
    whiteSpace: 'nowrap',
  },
  chipOn: { background: C.navy, borderColor: C.navy, color: 'white' },
  chipCustom: { color: C.muted, fontWeight: 400 },

  customRow: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' },

  hint: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    fontSize: 12.5,
    color: C.mutedLight,
  },
  hintPill: {
    padding: '3px 10px',
    borderRadius: R.pill,
    border: 'none',
    background: C.pinkBg,
    color: C.pinkDark,
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: 600,
  },

  repeatBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: R.card,
    border: `1px solid ${C.line}`,
    flexWrap: 'wrap',
  },
  repeatText: { flex: '1 1 220px', minWidth: 0 },
  repeatTitle: { fontSize: 13.5, fontWeight: 700, color: C.ink },

  failBox: { padding: 14, borderRadius: R.card, background: C.pinkBg },
  failTitle: { fontSize: 13, fontWeight: 700, color: C.pinkDark },
  failMeta: { fontSize: 12.5, color: C.pinkDark, marginTop: 4, opacity: 0.85 },

  actions: { display: 'flex', gap: 10, flexWrap: 'wrap' },

  input: {
    padding: '9px 12px',
    borderRadius: R.pill,
    border: `1px solid ${C.lineInput}`,
    background: C.card,
    color: C.ink,
    fontFamily: FONT,
    fontSize: 13.5,
    boxSizing: 'border-box',
  },
  ghostBtn: {
    padding: '9px 16px',
    borderRadius: R.pill,
    border: `1px solid ${C.lineInput}`,
    background: C.card,
    color: C.ink,
    fontFamily: FONT,
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  primaryBtn: {
    padding: '9px 18px',
    borderRadius: R.pill,
    border: 'none',
    background: C.navy,
    color: 'white',
    fontFamily: FONT,
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },

  muted: { color: C.mutedLight, fontSize: 13, margin: '12px 0 0' },
  error: { color: C.pinkDark, fontSize: 13, margin: '8px 0 0' },
  success: { color: C.green, fontSize: 13, margin: '8px 0 0' },
};

export default NotificationSettings;
