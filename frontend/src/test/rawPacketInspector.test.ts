import { describe, expect, it } from 'vitest';
import { PayloadType } from '@michaelhart/meshcore-decoder';

import './eSlices';
import i18n from '../i18n';
import { describeCiphertextStructure, formatHexByHop } from '../utils/rawPacketInspector';

describe('rawPacketInspector helpers', () => {
  it('formats path hex as hop-delimited groups', () => {
    expect(formatHexByHop('A1B2C3D4E5F6', 2)).toBe('A1B2 → C3D4 → E5F6');
    expect(formatHexByHop('AABBCC', 1)).toBe('AA → BB → CC');
  });

  it('leaves non-hop-aligned hex unchanged', () => {
    expect(formatHexByHop('A1B2C3', 2)).toBe('A1B2C3');
    expect(formatHexByHop('A1B2', null)).toBe('A1B2');
  });

  it('describes undecryptable ciphertext with multiline bullets', () => {
    expect(describeCiphertextStructure(PayloadType.GroupText, 9, 'fallback')).toBe(
      i18n.t('rawPacket.ciphertextGroup', { bytes: 9 })
    );
    expect(describeCiphertextStructure(PayloadType.TextMessage, 12, 'fallback')).toBe(
      i18n.t('rawPacket.ciphertextDm', { bytes: 12 })
    );
  });
});
