import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const OLD = '1ee5b9de-4864-475f-9602-ee039197e46e/comunicados/manual-chat-v1.pdf';
const NEW = '3daf9772-404f-42f4-adbf-8a2566d91870/comunicados/manual-chat-v1.pdf';
const { data: dl, error: e1 } = await sb.storage.from('chat-anexos').download(OLD);
if (e1) { console.error('download', e1); process.exit(1); }
const buf = Buffer.from(await dl.arrayBuffer());
console.log('downloaded bytes', buf.length);
const { error: e2 } = await sb.storage.from('chat-anexos').upload(NEW, buf, { contentType: 'application/pdf', upsert: true });
if (e2) { console.error('upload', e2); process.exit(1); }
console.log('uploaded ok');
const { error: e3 } = await sb.storage.from('chat-anexos').remove([OLD]);
if (e3) console.warn('remove warn', e3);
else console.log('removed old');
