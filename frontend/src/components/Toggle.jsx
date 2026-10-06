import React from 'react';
import { C, R } from '../theme';

const W = 44;
const H = 24;
const KNOB = 18;

// A pill switch for on/off settings. role="switch" rather than a styled
// checkbox so screen readers announce the state without a visible label.
function Toggle({ checked, onChange, disabled = false, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      style={{
        ...styles.track,
        background: checked ? C.navy : C.checkbox,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span
        style={{
          ...styles.knob,
          transform: `translateX(${checked ? W - KNOB - 3 : 3}px)`,
        }}
      />
    </button>
  );
}

const styles = {
  track: {
    width: W,
    height: H,
    borderRadius: R.sso,
    border: 'none',
    padding: 0,
    flexShrink: 0,
    position: 'relative',
    display: 'block',
    transition: 'background 140ms ease',
  },
  knob: {
    position: 'absolute',
    top: (H - KNOB) / 2,
    left: 0,
    width: KNOB,
    height: KNOB,
    borderRadius: R.sso,
    background: C.card,
    transition: 'transform 140ms ease',
  },
};

export default Toggle;
