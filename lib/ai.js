/**
 * AI API client — calls the OpenAI-compatible endpoint
 */

const AI_API_URL = process.env.AI_API_URL || 'https://autoglm-api.autoglm.ai/autoclaw-proxy/proxy/autoclaw';
const AI_API_KEY = process.env.AI_API_KEY || '';
const AI_MODEL = process.env.AI_MODEL || 'zai_auto';

const SYSTEM_PROMPT = `You are an expert web developer and designer. Generate complete, production-ready websites.

RULES:
1. Return ONLY valid HTML code. No markdown, no explanation, no code fences.
2. Include all CSS in a <style> tag in the <head>.
3. Include all JavaScript in a <script> tag at the end of <body>.
4. Make it fully responsive (mobile-first).
5. Use modern design — clean, professional, good typography and spacing.
6. Use only external resources from reliable CDNs (fonts, icons, etc).
7. Do NOT use any backend code — pure frontend HTML/CSS/JS only.
8. The page must be self-contained — a single HTML file that works when opened directly.
9. Use semantic HTML5 elements (header, nav, main, section, footer, etc).
10. Add proper meta viewport tag, charset, and a meaningful <title>.

If the user asks for a multi-page site, create a single-page application with sections or tab navigation.

Output format: Start directly with <!DOCTYPE html> — no other text before or after.`;

/**
 * Generate a website from a user prompt
 * @param {string} prompt - User's description of the website
 * @param {string} [model] - Optional model override
 * @returns {Promise<string>} - Generated HTML
 */
async function generateWebsite(prompt, model = AI_MODEL) {
  const response = await fetch(`${AI_API_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Create a website for: ${prompt}` }
      ],
      temperature: 0.7,
      max_tokens: 8192,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`AI API error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

  // Clean up: remove code fences if AI wrapped it
  let html = content.trim();
  html = html.replace(/^```html?\s*\n?/i, '').replace(/\n?```\s*$/, '');

  return html;
}

/**
 * Edit existing code based on user instruction
 * @param {string} currentCode - The existing HTML code
 * @param {string} instruction - What to change
 * @returns {Promise<string>} - Updated HTML
 */
async function editCode(currentCode, instruction) {
  const response = await fetch(`${AI_API_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [
        {
          role: 'system',
          content: `You are an expert web developer. Given the current HTML code and an edit instruction, return the FULL updated HTML code. 
Return ONLY the complete HTML — no markdown, no explanation, no code fences. Start directly with <!DOCTYPE html>.`
        },
        { role: 'user', content: `Current code:\n\`\`\`html\n${currentCode}\n\`\`\`\n\nEdit instruction: ${instruction}\n\nReturn the complete updated HTML.` }
      ],
      temperature: 0.3,
      max_tokens: 8192,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`AI API error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  let html = (data.choices?.[0]?.message?.content || '').trim();
  html = html.replace(/^```html?\s*\n?/i, '').replace(/\n?```\s*$/, '');
  return html;
}

module.exports = { generateWebsite, editCode };
