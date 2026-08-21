// تنشيط يومي تلقائي لقاعدة المفرجي (Supabase المجاني يُجمَّد بعد ٧ أيام خمول).
// يعمل مجدولاً كل يوم عبر Netlify Scheduled Functions — بلا خدمة خارجية.
// مفتاح anon عام وآمن (نفسه في public/almfrje/config.js) — قراءة فقط عبر RLS.
const URL = 'https://noupszhgfyqhfotokabj.supabase.co/rest/v1/almfrje_settings?select=key&limit=1';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vdXBzemhnZnlxaGZvdG9rYWJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3Njc5NDUsImV4cCI6MjA5NjM0Mzk0NX0.TmyNXiXOm1vhOfV07GWwKkvIdb23oIoeaYL20Wwcpv0';

export default async () => {
  try {
    const r = await fetch(URL, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` }, cache: 'no-store' });
    return new Response(`almfrje keepalive ok: ${r.status}`, { status: 200 });
  } catch (e) {
    return new Response(`keepalive error: ${e}`, { status: 200 });
  }
};

// جدولة: مرة كل يوم (بصيغة cron: الساعة 3:00 UTC يومياً)
export const config = { schedule: '0 3 * * *' };
