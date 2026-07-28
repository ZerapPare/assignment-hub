import React from 'react';
import { C, FONT } from '../theme';
import { DocIcon } from '../icons';

function BrandMark({ size = 22, fontSize = 17, weight = 700, hubColor = C.pink }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <DocIcon size={size} color={C.navy} />
      <span style={{ fontFamily: FONT, fontWeight: weight, fontSize, color: C.navy }}>
        Assignment
        <span style={{ color: hubColor }}>Hub</span>
      </span>
    </div>
  );
}

export default BrandMark;
