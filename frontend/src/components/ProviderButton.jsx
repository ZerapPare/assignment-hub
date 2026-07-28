import React, { useState } from 'react';
import { C, FONT, R, SHADOW } from '../theme';

// Reusable OAuth-provider sign-in button (Google / Microsoft / ...)
function ProviderButton({ icon, label, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ ...styles.btn, ...(hover ? styles.btnHover : null) }}
    >
      <span style={styles.icon}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

const styles = {
  btn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    padding: '14px 20px',
    fontSize: 15,
    fontWeight: 600,
    fontFamily: FONT,
    color: C.inkAlt,
    background: C.card,
    border: `1.5px solid ${C.lineBtn}`,
    borderRadius: R.sso,
    cursor: 'pointer',
    transition: 'box-shadow .15s, border-color .15s',
  },
  btnHover: {
    borderColor: C.lineBtnHover,
    boxShadow: SHADOW.ssoHover,
  },
  icon: { display: 'flex', alignItems: 'center' },
};

export default ProviderButton;
