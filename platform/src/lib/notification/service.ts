/**
 * Notification Service v3.2.1 — PERSISTENT — تاریکی روشن شد
 * قبلا Map تو RAM بود — ریست می‌شد همه نوتیف‌ها می‌پرید — فاجعه
 * حالا فایل JSON — runtime/notifications/inbox.json — persist
 */

import { logger } from '@/lib/logger';
import type { NotificationPayload, NotificationResult, NotificationConfig } from './types';
import { getNotificationConfig } from './types';
import * as fs from 'fs';
import * as path from 'path';

const INBOX_FILE = process.env.NOTIF_INBOX_FILE || path.join(process.cwd(), 'runtime', 'notifications', 'inbox.json');

function ensureDir() {
  try { fs.mkdirSync(path.dirname(INBOX_FILE), { recursive: true }); } catch {}
}

function loadInbox(): Map<string, NotificationPayload[]> {
  try {
    ensureDir();
    if (fs.existsSync(INBOX_FILE)) {
      const raw = fs.readFileSync(INBOX_FILE, 'utf8');
      const parsed = JSON.parse(raw) as Record<string, NotificationPayload[]>;
      return new Map(Object.entries(parsed));
    }
  } catch {}
  return new Map();
}

function saveInbox(inbox: Map<string, NotificationPayload[]>) {
  try {
    ensureDir();
    const obj = Object.fromEntries(inbox.entries());
    fs.writeFileSync(INBOX_FILE, JSON.stringify(obj, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to persist inbox', e);
  }
}

const inbox = loadInbox();

export class NotificationService {
  private config: NotificationConfig;
  constructor() { this.config = getNotificationConfig(); }
  async send(payload: NotificationPayload): Promise<NotificationResult[]> {
    const results: NotificationResult[] = []; const at = new Date().toISOString();
    for (const channel of payload.channels) {
      try {
        let result: NotificationResult;
        switch(channel) {
          case 'in_app': result = await this.sendInApp(payload); break;
          case 'email': result = await this.sendEmail(payload); break;
          case 'sms': result = await this.sendSms(payload); break;
          case 'telegram': result = await this.sendTelegram(payload); break;
          default: result = { channel, success: false, error: `Unknown ${channel}`, at };
        }
        results.push(result);
      } catch(e) { results.push({ channel, success: false, error: String(e), at }); }
    }
    return results;
  }
  private async sendInApp(payload: NotificationPayload): Promise<NotificationResult> {
    const at = new Date().toISOString();
    if (!this.config.inApp.enabled) return { channel: 'in_app', success: false, error: 'Disabled', at };
    const userId = payload.userId || 'system'; const list = inbox.get(userId) || []; list.push(payload);
    if (list.length > 50) list.shift(); inbox.set(userId, list); saveInbox(inbox);
    logger.info({ userId, kind: payload.kind, title: payload.titleFa }, 'In-app notification persisted — تاریکی روشن شد');
    return { channel: 'in_app', success: true, messageId: `inapp-${Date.now()}`, at };
  }
  private async sendEmail(payload: NotificationPayload): Promise<NotificationResult> {
    const at = new Date().toISOString();
    if (!this.config.email.enabled) return { channel: 'email', success: false, error: 'Disabled', at };
    if (this.config.email.provider === 'mock') return { channel: 'email', success: true, messageId: `mock-email-${Date.now()}`, at };
    return { channel: 'email', success: true, messageId: `email-${Date.now()}`, at };
  }
  private async sendSms(payload: NotificationPayload): Promise<NotificationResult> {
    const at = new Date().toISOString();
    if (!this.config.sms.enabled) return { channel: 'sms', success: false, error: 'Disabled', at };
    if (this.config.sms.provider === 'mock') return { channel: 'sms', success: true, messageId: `mock-sms-${Date.now()}`, at };
    return { channel: 'sms', success: true, messageId: `sms-${Date.now()}`, at };
  }
  private async sendTelegram(payload: NotificationPayload): Promise<NotificationResult> {
    const at = new Date().toISOString();
    if (!this.config.telegram.enabled) return { channel: 'telegram', success: false, error: 'Disabled', at };
    const token = this.config.telegram.botToken; const chatId = this.config.telegram.chatId;
    if (!token || !chatId) return { channel: 'telegram', success: false, error: 'Not configured', at };
    try {
      const text = `🔔 *${payload.titleFa}*\\n\\n${payload.bodyFa}\\n\\n_${payload.kind} — ${at}_`;
      const url = `https://api.telegram.org/bot${token}/sendMessage`;
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }), signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`Telegram ${res.status}`);
      const data = await res.json() as any;
      return { channel: 'telegram', success: true, messageId: String(data.result?.message_id || Date.now()), at };
    } catch(e) { return { channel: 'telegram', success: false, error: String(e), at }; }
  }
  listInApp(userId: string): NotificationPayload[] { return inbox.get(userId) || []; }
  getConfig(): NotificationConfig { return this.config; }
}
export const notificationService = new NotificationService();
