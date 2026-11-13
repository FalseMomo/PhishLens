import { assess, combineAssessments } from '../../extension/heuristic-detector.js';
import { analyzeWithAi } from './ai-analysis.js';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type, x-phishlens-token'
};

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: Object.assign({ 'content-type': 'application/json' }, CORS)
  });
}

function cleanEmail(input) {
  if (!input || typeof input !== 'object') return null;
  const sender = input.sender && typeof input.sender === 'object' ? input.sender : {};
  const links = Array.isArray(input.links) ? input.links.slice(0, 20).map(function (link) {
    return {
      text: String((link && link.text) || '').slice(0, 180),
      url: String((link && link.url) || '').slice(0, 500)
    };
  }) : [];
  return {
    messageId: String(input.messageId || '').slice(0, 128),
    threadId: String(input.threadId || '').slice(0, 128),
    sender: {
      email: String(sender.email || '').slice(0, 320),
      displayName: String(sender.displayName || '').slice(0, 200)
    },
    subject: String(input.subject || '').slice(0, 300),
    body: String(input.body || '').slice(0, 20000),
    links: links,
    authentication: input.authentication && typeof input.authentication === 'object'
      ? input.authentication
      : { available: false, spf: null, dkim: null, dmarc: null }
  };
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/analyze') {
      return json({ error: 'not_found' }, 404);
    }
    if (env.DEMO_TOKEN && request.headers.get('x-phishlens-token') !== env.DEMO_TOKEN) {
      return json({ error: 'unauthorized' }, 401);
    }

    let payload;
    try {
      payload = await request.json();
    } catch (error) {
      return json({ error: 'invalid_json' }, 400);
    }
    const email = cleanEmail(payload);
    if (!email || !email.messageId) return json({ error: 'message_id_required' }, 400);

    const rules = assess(email);
    let ai = null;
    let aiError = null;
    try {
      ai = await analyzeWithAi(env, email);
    } catch (error) {
      aiError = error && error.message ? error.message : 'Workers AI failed.';
    }

    const combined = ai ? combineAssessments(rules.findings, ai.findings) : rules;
    const auth = email.authentication || {};
    return json({
      requestId: String(payload.requestId || ''),
      messageId: email.messageId,
      score: combined.score,
      riskLevel: combined.riskLevel,
      summary: ai && ai.summary ? ai.summary : combined.summary,
      findings: combined.findings,
      threatIntelligence: { status: 'unavailable' },
      authenticationAssessment: {
        available: Boolean(auth.available),
        spf: auth.spf || null,
        dkim: auth.dkim || null,
        dmarc: auth.dmarc || null
      },
      analysisMethod: ai ? 'workers_ai' : 'rules_ai_unavailable',
      analysisStatus: ai ? 'complete' : 'ai_unavailable',
      aiError: aiError,
      analyzedAt: new Date().toISOString()
    });
  }
};
