import { API_ENDPOINTS } from '../config/api';
import { getCode } from '../utils/languages';

export async function translateText(text, targetLang, signal) {
  const langCode = getCode(targetLang);
  if (!langCode || langCode === 'en') return text;

  const response = await fetch(API_ENDPOINTS.TRANSLATE, {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, targetLang: langCode }), signal,
  });
  const data = await response.json();
  if (!response.ok || typeof data.text !== 'string' || !data.text.trim() || data.text.length > 32000) throw new Error('Translation unavailable');
  return data.text;
}
