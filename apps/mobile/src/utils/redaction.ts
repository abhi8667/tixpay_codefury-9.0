let isRedactionOn = true;

export const setRedactionEnabled = (enabled: boolean) => {
  isRedactionOn = enabled;
};

export const getRedactionEnabled = () => isRedactionOn;

export const redact = {
  vpa: (v: string): string => {
    if (!isRedactionOn || !v) return v;
    const parts = v.split('@');
    if (parts.length < 2) return v;
    const handle = parts[0] ?? '';
    const domain = parts[1] ?? '';
    const maskedHandle = handle.length > 2 ? `${handle.slice(0, 2)}****` : `${handle}****`;
    return `${maskedHandle}@${domain}`;
  },

  tail: (t: string): string => {
    if (!isRedactionOn || !t) return t;
    return '••' + t.slice(-4);
  },

  /**
   * A statement narration, with reference and account numbers masked.
   *
   * Amounts stay intact on purpose — they are the point of every screen that
   * renders one, and masking them would make the projector demo unreadable
   * while protecting nothing. The long digit runs are the identifying part.
   */
  narration: (text: string): string => {
    if (!isRedactionOn || !text) return text;
    return text.replace(/\b\d{6,16}\b/g, (match) => 'X'.repeat(match.length));
  },
};
