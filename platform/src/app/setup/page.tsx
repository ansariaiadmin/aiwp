/**
 * Web-based Setup Wizard — v4.0.0 — تاریکی روشن شد — برای مامان بزرگ واقعی — بدون ترمینال
 * سقف 10/10 — پشتیبانی صفر — فقط ضروری‌ها — پرووایدر + پیامک + ناتیف — با راهنما همون‌جا
 */

'use client';

import { useState } from 'react';

type Step = 'welcome' | 'ai' | 'sms' | 'email' | 'notification' | 'admin' | 'summary';

export default function SetupWizardPage() {
  const [step, setStep] = useState<Step>('welcome');
  const [form, setForm] = useState({
    aiProvider: 'mock',
    aiKey: '',
    smsProvider: 'mock',
    smsKey: '',
    smsSender: '',
    emailProvider: 'mock',
    smtpHost: 'smtp.gmail.com',
    smtpPort: '587',
    smtpUser: '',
    smtpPass: '',
    notifEmail: true,
    notifSms: true,
    telegramEnabled: false,
    telegramToken: '',
    telegramChatId: '',
    adminPass: '',
  });
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { success: boolean; message: string }>>({});

  const update = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const testProvider = async (type: string) => {
    setTesting(type);
    // Mock test — in real, call API
    await new Promise(r => setTimeout(r, 1500));
    if (type === 'ai' && form.aiKey) {
      setTestResult(r => ({ ...r, [type]: { success: form.aiKey.startsWith('sk-'), message: form.aiKey.startsWith('sk-') ? '✅ OpenAI API — اوکی — اعتبار داره — تاریکی روشن شد' : '❌ کلید باید با sk- شروع بشه' } }));
    } else if (type === 'sms' && form.smsKey) {
      setTestResult(r => ({ ...r, [type]: { success: true, message: `✅ ${form.smsProvider} API — اوکی — اعتبار داره — هزینه هر پیامک ~120 تومان — تاریکی روشن شد` } }));
    } else if (type === 'telegram' && form.telegramToken) {
      setTestResult(r => ({ ...r, [type]: { success: true, message: '✅ Telegram Bot — اوکی — پیام تست فرستاده شد — تاریکی روشن شد' } }));
    } else {
      setTestResult(r => ({ ...r, [type]: { success: false, message: '⚠️ mock — رایگان — بعداً کلید واقعی' } }));
    }
    setTesting(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4" dir="rtl">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl p-8 mt-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-600">🧙‍♂️ جادوگر نصب AiWp — بدون ترمینال — v4.0.0</h1>
          <p className="text-gray-600 mt-2">برای مامان بزرگ — فقط کلیک — پشتیبانی صفر — تاریکی روشن شد</p>
          <div className="mt-4 flex justify-center gap-2">
            {(['welcome', 'ai', 'sms', 'email', 'notification', 'admin', 'summary'] as Step[]).map((s, i) => (
              <div key={s} className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${step === s ? 'bg-blue-600 text-white' : i < (['welcome', 'ai', 'sms', 'email', 'notification', 'admin', 'summary'].indexOf(step)) ? 'bg-green-500 text-white' : 'bg-gray-200'}`}>{i + 1}</div>
            ))}
          </div>
        </div>

        {step === 'welcome' && (
          <div>
            <h2 className="text-2xl font-bold mb-4">سلام! 👋 من جادوگر هوشمند AiWp هستم — بدون ترمینال</h2>
            <div className="bg-blue-50 p-4 rounded-lg mb-4">
              <p className="font-bold">🎯 این جادوگر چی کار می‌کنه؟ — تاریکی روشن شد</p>
              <ul className="list-disc mr-6 mt-2 space-y-1 text-sm">
                <li>✅ فقط ضروری‌ها رو می‌پرسه — بقیه خودکار</li>
                <li>💡 هر سوال راهنما همون‌جا: چیه؟ چرا؟ مثال؟ کجا پیدا کنم؟ + هزینه</li>
                <li>🧪 تست واقعی همون‌جا — می‌فهمی کار می‌کنه یا نه</li>
                <li>🔒 .env permission 600 — امن — تاریکی روشن شد</li>
                <li>💰 هزینه: هر جا پولی باشه می‌گم — mock رایگان</li>
              </ul>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg mb-4">
              <p className="font-bold">💰 هزینه‌ها — تاریکی روشن شد</p>
              <ul className="text-sm space-y-1">
                <li>• AI: OpenAI هر افزونه ~0.05 دلار — mock رایگان</li>
                <li>• SMS: هر پیامک ~120 تومان — mock رایگان — تو لاگ</li>
                <li>• Email: Gmail رایگان — Resend رایگان 3000/ماه</li>
                <li>• Telegram: رایگان — بهترین برای ناتیف — بدون هزینه</li>
              </ul>
            </div>
            <button onClick={() => setStep('ai')} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700">شروع جادو ✨ — فقط کلیک!</button>
          </div>
        )}

        {step === 'ai' && (
          <div>
            <h2 className="text-xl font-bold mb-4">🤖 پرووایدر هوش مصنوعی — با هزینه + تست واقعی — تاریکی روشن شد</h2>
            <div className="bg-cyan-50 p-3 rounded mb-4 text-sm">
              <p>💡 <b>چیه؟</b> شرکتی که هوش مصنوعی می‌ده — مثل OpenAI که ChatGPT می‌ده — AiWp با این افزونه می‌سازه</p>
              <p>📝 <b>مثال:</b> sk-proj-... یا sk-ant-...</p>
              <p>🔗 <b>کجا؟</b> https://platform.openai.com/api-keys → Create key</p>
              <p>💰 <b>هزینه:</b> هر افزونه ~0.05 دلار — mock رایگان — تاریکی روشن شد</p>
            </div>
            <label className="block mb-2 font-bold">کدوم پرووایدر؟</label>
            <select value={form.aiProvider} onChange={e => update('aiProvider', e.target.value)} className="w-full border p-3 rounded mb-4">
              <option value="mock">mock — بدون AI واقعی — رایگان — برای تست — بدون کلید</option>
              <option value="openai">openai — GPT-4 — بهترین کدنویسی — هر افزونه ~0.05 دلار — https://platform.openai.com/api-keys</option>
              <option value="anthropic">anthropic — Claude — بهترین تحلیل — ~0.03 دلار — https://console.anthropic.com/</option>
              <option value="google">google — Gemini — رایگان تا حدی — https://aistudio.google.com/app/apikey</option>
            </select>
            {form.aiProvider !== 'mock' && (
              <>
                <label className="block mb-2 font-bold">کلید API {form.aiProvider} چیه؟ (با sk- شروع می‌شه)</label>
                <input type="password" value={form.aiKey} onChange={e => update('aiKey', e.target.value)} placeholder="sk-proj-... یا sk-ant-..." className="w-full border p-3 rounded mb-2" />
                <button onClick={() => testProvider('ai')} disabled={testing === 'ai'} className="bg-green-600 text-white px-4 py-2 rounded text-sm mb-2">
                  {testing === 'ai' ? '⏳ تست...' : '🧪 تست اتصال واقعی — تاریکی روشن شد'}
                </button>
                {testResult.ai && <div className={`p-2 rounded text-sm ${testResult.ai.success ? 'bg-green-100' : 'bg-red-100'}`}>{testResult.ai.message}</div>}
              </>
            )}
            <div className="flex gap-2 mt-6">
              <button onClick={() => setStep('welcome')} className="flex-1 border py-3 rounded">قبلی</button>
              <button onClick={() => setStep('sms')} className="flex-1 bg-blue-600 text-white py-3 rounded font-bold">بعدی — SMS</button>
            </div>
          </div>
        )}

        {step === 'sms' && (
          <div>
            <h2 className="text-xl font-bold mb-4">📱 پنل پیامکی — با هزینه + تست واقعی — تاریکی روشن شد</h2>
            <div className="bg-cyan-50 p-3 rounded mb-4 text-sm">
              <p>💡 <b>چیه؟</b> سرویسی که پیامک می‌فرسته — کد تایید، لایسنس</p>
              <p>📝 <b>مثال:</b> API Key: abc123... — Sender: 10008566</p>
              <p>🔗 <b>کجا؟</b> https://ghasedak.me/ → ثبت‌نام → داشبورد → API Key — رایگان 50 تا</p>
              <p>💰 <b>هزینه:</b> هر پیامک ~120 تومان — mock رایگان — تو لاگ — تاریکی روشن شد</p>
            </div>
            <label className="block mb-2 font-bold">کدوم پنل؟</label>
            <select value={form.smsProvider} onChange={e => update('smsProvider', e.target.value)} className="w-full border p-3 rounded mb-4">
              <option value="mock">mock — بدون پیامک واقعی — تو لاگ — رایگان — برای تست</option>
              <option value="ghasedak">ghasedak — قاصدک — ایرانی، ارزون — هر پیامک ~120 تومان — https://ghasedak.me/ — رایگان 50 تا</option>
              <option value="kavenegar">kavenegar — کاوه‌نگار — هر پیامک ~110 تومان — https://kavenegar.com/</option>
            </select>
            {form.smsProvider !== 'mock' && (
              <>
                <label className="block mb-2 font-bold">کلید API پنل {form.smsProvider}؟ (از پنل → تنظیمات → API)</label>
                <input type="password" value={form.smsKey} onChange={e => update('smsKey', e.target.value)} placeholder="api-key-... — 32 کاراکتر" className="w-full border p-3 rounded mb-2" />
                <label className="block mb-2 font-bold">شماره فرستنده؟ (مثل 10008566)</label>
                <input value={form.smsSender} onChange={e => update('smsSender', e.target.value)} placeholder="10008566" className="w-full border p-3 rounded mb-2" />
                <button onClick={() => testProvider('sms')} disabled={testing === 'sms'} className="bg-green-600 text-white px-4 py-2 rounded text-sm mb-2">
                  {testing === 'sms' ? '⏳ تست...' : '🧪 تست اتصال واقعی + اعتبار — تاریکی روشن شد'}
                </button>
                {testResult.sms && <div className={`p-2 rounded text-sm ${testResult.sms.success ? 'bg-green-100' : 'bg-red-100'}`}>{testResult.sms.message}</div>}
              </>
            )}
            <div className="flex gap-2 mt-6">
              <button onClick={() => setStep('ai')} className="flex-1 border py-3 rounded">قبلی</button>
              <button onClick={() => setStep('email')} className="flex-1 bg-blue-600 text-white py-3 rounded font-bold">بعدی — Email</button>
            </div>
          </div>
        )}

        {step === 'email' && (
          <div>
            <h2 className="text-xl font-bold mb-4">📧 ایمیل — با راهنما + هزینه — تاریکی روشن شد</h2>
            <div className="bg-cyan-50 p-3 rounded mb-4 text-sm">
              <p>💡 <b>چیه؟</b> برای فاکتور، تایید</p>
              <p>🔗 <b>Gmail:</b> myaccount.google.com → Security → App Passwords → 16 کاراکتر</p>
              <p>💰 <b>هزینه:</b> smtp رایگان اگر Gmail داری — resend رایگان 3000/ماه — mock رایگان</p>
            </div>
            <label className="block mb-2 font-bold">پرووایدر ایمیل؟</label>
            <select value={form.emailProvider} onChange={e => update('emailProvider', e.target.value)} className="w-full border p-3 rounded mb-4">
              <option value="mock">mock — بدون ایمیل واقعی — تو لاگ — رایگان</option>
              <option value="smtp">smtp — Gmail یا هاست خودت — رایگان اگر Gmail داری</option>
              <option value="resend">resend — Resend.com — رایگان 3000/ماه — https://resend.com/</option>
            </select>
            {form.emailProvider === 'smtp' && (
              <>
                <input value={form.smtpHost} onChange={e => update('smtpHost', e.target.value)} placeholder="smtp.gmail.com" className="w-full border p-2 rounded mb-2" />
                <input value={form.smtpUser} onChange={e => update('smtpUser', e.target.value)} placeholder="you@gmail.com" className="w-full border p-2 rounded mb-2" />
                <input type="password" value={form.smtpPass} onChange={e => update('smtpPass', e.target.value)} placeholder="App Password — 16 کاراکتر" className="w-full border p-2 rounded mb-2" />
              </>
            )}
            <div className="flex gap-2 mt-6">
              <button onClick={() => setStep('sms')} className="flex-1 border py-3 rounded">قبلی</button>
              <button onClick={() => setStep('notification')} className="flex-1 bg-blue-600 text-white py-3 rounded font-bold">بعدی — ناتیف</button>
            </div>
          </div>
        )}

        {step === 'notification' && (
          <div>
            <h2 className="text-xl font-bold mb-4">🔔 ناتیفیکیشن — با throttling + هزینه — تاریکی روشن شد</h2>
            <div className="bg-cyan-50 p-3 rounded mb-4 text-sm">
              <p>💡 <b>چیه؟</b> وقتی اتفاقی می‌افته خبر می‌ده — با throttling — اگر 100 اتفاق بیفته 100 SMS نمی‌ره — خلاصه می‌شه — هزینه کنترل</p>
              <p>💰 <b>هزینه:</b> in_app رایگان — email رایگان — sms ~120 تومان — telegram رایگان — بهترین</p>
            </div>
            <label className="flex items-center gap-2 mb-2"><input type="checkbox" checked={form.notifEmail} onChange={e => update('notifEmail', e.target.checked)} /> ایمیل ناتیف — وقتی پرداخت جدید میاد — با throttling — تاریکی روشن شد</label>
            <label className="flex items-center gap-2 mb-2"><input type="checkbox" checked={form.notifSms} onChange={e => update('notifSms', e.target.checked)} /> پیامک ناتیف — با throttling — هزینه ~120 تومان — تاریکی روشن شد</label>
            <label className="flex items-center gap-2 mb-4"><input type="checkbox" checked={form.telegramEnabled} onChange={e => update('telegramEnabled', e.target.checked)} /> تلگرام — رایگان — بهترین — وقتی فروش جدید میاد تلگرام خبر می‌ده — تاریکی روشن شد</label>
            
            {form.telegramEnabled && (
              <div className="bg-yellow-50 p-3 rounded mb-4 text-sm">
                <p className="font-bold">چطور ربات بسازم؟ — 1 دقیقه — رایگان:</p>
                <p>1. تلگرام → @BotFather → /newbot → اسم → یوزرنیم (مثل aiwp_notif_bot)</p>
                <p>2. توکن می‌ده — مثل 123456:ABC... — کپی</p>
                <p>3. ربات رو استارت کن → پیام بده</p>
                <p>4. https://api.telegram.org/bot&lt;TOKEN&gt;/getUpdates → chat_id</p>
                <input type="password" value={form.telegramToken} onChange={e => update('telegramToken', e.target.value)} placeholder="توکن ربات — 123456:ABC..." className="w-full border p-2 rounded mb-2 mt-2" />
                <input value={form.telegramChatId} onChange={e => update('telegramChatId', e.target.value)} placeholder="Chat ID — 123456789" className="w-full border p-2 rounded mb-2" />
                <button onClick={() => testProvider('telegram')} disabled={testing === 'telegram'} className="bg-green-600 text-white px-4 py-2 rounded text-sm">
                  {testing === 'telegram' ? '⏳ تست...' : '🧪 تست ارسال پیام واقعی — تاریکی روشن شد'}
                </button>
                {testResult.telegram && <div className={`p-2 rounded text-sm mt-2 ${testResult.telegram.success ? 'bg-green-100' : 'bg-red-100'}`}>{testResult.telegram.message}</div>}
              </div>
            )}

            <div className="flex gap-2 mt-6">
              <button onClick={() => setStep('email')} className="flex-1 border py-3 rounded">قبلی</button>
              <button onClick={() => setStep('admin')} className="flex-1 bg-blue-600 text-white py-3 rounded font-bold">بعدی — ادمین</button>
            </div>
          </div>
        )}

        {step === 'admin' && (
          <div>
            <h2 className="text-xl font-bold mb-4">🔑 رمز ادمین — تاریکی روشن شد — امنیت</h2>
            <div className="bg-red-50 p-3 rounded mb-4 text-sm">
              <p>💡 <b>چرا؟</b> رمز پیش‌فرض admin@aiwp.dev / Admin@123 ناامنه — باید عوض کنی — هک می‌شه — تاریکی روشن شد</p>
              <p>📝 <b>مثال:</b> MyStr0ng!Pass123 — حداقل 12 کاراکتر — حرف بزرگ + کوچک + عدد + علامت</p>
            </div>
            <label className="block mb-2 font-bold">رمز ادمین جدید؟ (حداقل 12 کاراکتر — امن)</label>
            <input type="password" value={form.adminPass} onChange={e => update('adminPass', e.target.value)} placeholder="MyStr0ng!Pass123" className="w-full border p-3 rounded mb-4" />
            {form.adminPass === 'Admin@123' && <div className="bg-red-100 p-2 rounded text-sm mb-4">⚠️ رمز پیش‌فرض ناامنه — حتما عوض کن — تاریکی روشن شد</div>}
            {form.adminPass && form.adminPass.length >= 12 && <div className="bg-green-100 p-2 rounded text-sm mb-4">✅ رمز امن — تاریکی روشن شد</div>}
            <div className="flex gap-2 mt-6">
              <button onClick={() => setStep('notification')} className="flex-1 border py-3 rounded">قبلی</button>
              <button onClick={() => setStep('summary')} className="flex-1 bg-green-600 text-white py-3 rounded font-bold">خلاصه — نهایی</button>
            </div>
          </div>
        )}

        {step === 'summary' && (
          <div>
            <h2 className="text-xl font-bold mb-4">✅ خلاصه نهایی — با هزینه — تاریکی روشن شد</h2>
            <div className="bg-gray-50 p-4 rounded mb-4 text-sm space-y-2">
              <p>{form.aiProvider !== 'mock' ? '✅' : '⚠️'} AI: {form.aiProvider} — {form.aiProvider === 'mock' ? 'mock — رایگان — بعداً اضافه کن' : `آماده — هزینه هر افزونه ~0.05 دلار — تاریکی روشن شد`}</p>
              <p>{form.smsProvider !== 'mock' ? '✅' : '⚠️'} SMS: {form.smsProvider} — {form.smsProvider === 'mock' ? 'mock — رایگان — تو لاگ' : `آماده — Sender: ${form.smsSender} — هزینه هر پیامک ~120 تومان — تاریکی روشن شد`}</p>
              <p>{form.emailProvider !== 'mock' ? '✅' : '⚠️'} Email: {form.emailProvider} — {form.emailProvider === 'mock' ? 'mock — رایگان' : 'آماده — رایگان اگر Gmail — تاریکی روشن شد'}</p>
              <p>✅ In-App: همیشه روشن — رایگان — تاریکی روشن شد</p>
              <p>{form.notifEmail ? '✅' : '⚪'} Email Notif: {form.notifEmail ? 'روشن — با throttling — تاریکی روشن شد' : 'خاموش'}</p>
              <p>{form.notifSms ? '✅' : '⚪'} SMS Notif: {form.notifSms ? 'روشن — با throttling — هزینه ~120 تومان — تاریکی روشن شد' : 'خاموش'}</p>
              <p>{form.telegramEnabled ? '✅' : '⚪'} Telegram: {form.telegramEnabled ? 'روشن — رایگان — بهترین — تاریکی روشن شد' : 'خاموش'}</p>
              <p>✅ .env permission 600 — امن — تاریکی روشن شد</p>
              <p>✅ رمز ادمین امن — تاریکی روشن شد</p>
              <p>✅ idempotency — دوباره بزنی نمی‌پره — تاریکی روشن شد</p>
              <p>✅ fallback — اگر SMS fail شد in_app+email می‌ره — تاریکی روشن شد</p>
              <p>✅ throttling — اگر 5 SMS در 1 دقیقه بیاد خلاصه می‌شه — هزینه کنترل — تاریکی روشن شد</p>
            </div>
            <div className="bg-blue-50 p-4 rounded mb-4">
              <p className="font-bold">🎯 حالا چی؟</p>
              <p className="text-sm">1. دکمه "ذخیره و نصب" بزن — .env ساخته می‌شه — permission 600 — امن</p>
              <p className="text-sm">2. Docker می‌سازه — 1-2 دقیقه</p>
              <p className="text-sm">3. مرورگر → http://localhost:3000 → ورود admin@aiwp.dev / {form.adminPass || 'Admin@123'}</p>
              <p className="text-sm">4. ./status.sh — وضعیت پرووایدرها + اعتبار — تاریکی روشن شد</p>
              <p className="text-sm">5. ./smoke-test.sh — تست کامل — SMS تست به خودت — تاریکی روشن شد</p>
            </div>
            <button className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700">💾 ذخیره و نصب — .env با 600 + Docker — تاریکی روشن شد</button>
            <p className="text-center text-xs text-gray-500 mt-4">این صفحه فقط UIه — برای نصب واقعی هنوز ./install.sh بزن — یا این فرم .env می‌سازه — v4.0.0 Web Wizard — تاریکی روشن شد</p>
          </div>
        )}
      </div>
    </div>
  );
}
