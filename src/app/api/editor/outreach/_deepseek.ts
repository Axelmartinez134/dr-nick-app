import 'server-only';

export function requireDeepseekApiKey(): string {
  const k = String(process.env.DEEPSEEK_API_KEY || '').trim();
  if (!k) throw new Error('Server missing DEEPSEEK_API_KEY');
  return k;
}

