import type { RawSms, InboxSource } from '@tixpay/types';
import demoInboxFixture from '../../../packages/engine/fixtures/demo_inbox.json';

export type { InboxSource };

export class DeviceInbox implements InboxSource {
  async read(since?: Date): Promise<RawSms[]> {
    try {
      // Lazy-load react-native-get-sms-android so simulator / mock environments don't crash
      let SmsAndroid: any;
      try {
        // @ts-ignore
        SmsAndroid = (await import('react-native-get-sms-android')).default || (await import('react-native-get-sms-android'));
      } catch {
        return [];
      }

      if (!SmsAndroid || typeof SmsAndroid.list !== 'function') {
        return [];
      }

      const filter: Record<string, any> = {
        box: 'inbox',
        maxCount: 5000,
      };

      if (since) {
        filter.minDate = since.getTime();
      }

      return new Promise<RawSms[]>((resolve) => {
        try {
          SmsAndroid.list(
            JSON.stringify(filter),
            (fail: any) => {
              console.warn('[DeviceInbox] Failed to read SMS:', fail);
              resolve([]);
            },
            (count: number, smsListStr: string) => {
              try {
                const parsed = typeof smsListStr === 'string' ? JSON.parse(smsListStr) : smsListStr;
                if (!Array.isArray(parsed)) {
                  resolve([]);
                  return;
                }
                const result: RawSms[] = parsed.map((item: any) => ({
                  address: String(item.address || ''),
                  body: String(item.body || ''),
                  date: Number(item.date || Date.now()),
                }));
                resolve(result);
              } catch (e) {
                console.warn('[DeviceInbox] JSON parse error on SMS list:', e);
                resolve([]);
              }
            }
          );
        } catch (e) {
          console.warn('[DeviceInbox] Exception during SmsAndroid.list call:', e);
          resolve([]);
        }
      });
    } catch (err) {
      console.warn('[DeviceInbox] General exception:', err);
      return [];
    }
  }
}

export class SeededInbox implements InboxSource {
  private data: RawSms[];

  constructor(customData?: RawSms[]) {
    this.data = customData || (demoInboxFixture as RawSms[]);
  }

  async read(since?: Date): Promise<RawSms[]> {
    if (!since) {
      return [...this.data];
    }
    const minTimestamp = since.getTime();
    return this.data.filter((msg) => msg.date >= minTimestamp);
  }
}
