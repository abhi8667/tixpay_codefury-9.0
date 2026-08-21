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
    const handle = parts[0];
    const domain = parts[1];
    const maskedHandle = handle.length > 2 ? handle.slice(0, 2) + '****' : handle + '****';
    return `${maskedHandle}@${domain}`;
  },

  tail: (t: string): string => {
    if (!isRedactionOn || !t) return t;
    return '••' + t.slice(-4);
  },

  smsBody: (body: string): string => {
    if (!isRedactionOn || !body) return body;
    // Mask account numbers and phone numbers, keep amounts intact
    return body.replace(/\b\d{6,16}\b/g, (match) => 'X'.repeat(match.length));
  },
};
