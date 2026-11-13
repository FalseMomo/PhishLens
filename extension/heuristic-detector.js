'use strict';

const MULTI_PART_SUFFIXES = new Set(['co.uk', 'org.uk', 'ac.uk', 'com.au', 'co.jp', 'com.br']);
const WEIGHT = { high: 34, medium: 16, low: 6 };

export function registrableDomain(hostname) {
  const host = String(hostname || '').replace(/\.$/, '').toLowerCase();
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return host;
  const labels = host.split('.').filter(Boolean);
  if (labels.length < 2) return host;
  const tail = labels.slice(-2).join('.');
  if (MULTI_PART_SUFFIXES.has(tail) && labels.length >= 3) return labels.slice(-3).join('.');
  return tail;
}

function finding(category, title, severity, evidence) {
  return { category: category, title: title, severity: severity, evidence: evidence, source: 'rules' };
}

function hostFromUrl(value) {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch (error) {
    return '';
  }
}

function hostInText(value) {
  const match = String(value || '').match(/\b((?:[a-z0-9-]+\.)+[a-z]{2,})\b/i);
  return match ? match[1].toLowerCase() : '';
}

function dedupe(findings) {
  const seen = new Set();
  return findings.filter(function (item) {
    const key = item.title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function scoreFindings(findings) {
  const categories = new Set(findings.map(function (item) { return item.category; }));
  let score = findings.reduce(function (total, item) {
    return total + (WEIGHT[item.severity] || 0);
  }, 0);
  if (categories.size === 1 && categories.has('urgency')) score = Math.min(score, 18);
  score = Math.max(0, Math.min(100, score));
  const riskLevel = score >= 70 ? 'high' : score >= 30 ? 'suspicious' : 'low';
  return { score: score, riskLevel: riskLevel };
}

function summaryFor(result, findings) {
  if (!findings.length) return 'No strong phishing indicators were found. This is not a guarantee the message is safe.';
  if (result.riskLevel === 'high') return 'Several strong indicators are present. Avoid links until the sender is verified another way.';
  if (result.riskLevel === 'suspicious') return 'Some indicators need a closer look. Urgency alone is not treated as proof.';
  return 'Only weak indicators were found. This score is a heuristic, not a probability.';
}

export function assess(email) {
  const findings = [];
  const senderEmail = email && email.sender && email.sender.email ? email.sender.email : '';
  const senderDomain = registrableDomain(senderEmail.split('@')[1] || '');
  const text = ((email && email.subject) || '') + '\n' + ((email && email.body) || '');
  const links = (email && email.links) || [];

  links.forEach(function (link) {
    let parsed;
    try {
      parsed = new URL(link.url);
    } catch (error) {
      return;
    }
    const host = parsed.hostname.toLowerCase();
    const registered = registrableDomain(host);
    const extra = host.split('.').length - registered.split('.').length;
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
      findings.push(finding('url', 'Link uses a raw IP address', 'high', link.url));
    }
    if (host.indexOf('xn--') !== -1) {
      findings.push(finding('url', 'Link uses punycode', 'high', host));
    }
    if (parsed.protocol === 'http:') {
      findings.push(finding('url', 'Link is not encrypted', 'medium', link.url));
    }
    if (extra >= 2) {
      findings.push(finding('domain', 'Link hides its real registrable domain', 'high', host + ' is registered under ' + registered));
    }
    const displayHost = hostInText(link.text);
    if (displayHost && registrableDomain(displayHost) !== registered) {
      findings.push(finding('url', 'Displayed link does not match the destination', 'high', link.text + ' -> ' + link.url));
    }
    if (senderDomain && registered && registered !== senderDomain) {
      findings.push(finding('domain', 'Link domain differs from the sender domain', 'medium', senderDomain + ' vs ' + registered));
    }
  });

  if (/\b(password|one-time code|otp|verification code|ssn|social security)\b/i.test(text)) {
    findings.push(finding('credential', 'Message asks for credentials or a secret code', 'medium', 'credential language'));
  }
  if (/\b(gift card|wire transfer|bitcoin|crypto|routing number|bank account)\b/i.test(text)) {
    findings.push(finding('payment', 'Message requests a payment or financial change', 'high', 'payment language'));
  }
  if (/\b(urgent|immediately|act now|suspended|within 24 hours)\b/i.test(text)) {
    findings.push(finding('urgency', 'Message uses urgency', 'low', 'urgency language'));
  }
  if (/\b(job offer|hiring|salary|remote position|onboarding)\b/i.test(text) && findings.some(function (item) { return item.severity === 'high' && item.category === 'domain'; })) {
    findings.push(finding('employment', 'Job offer is paired with a misleading domain', 'high', 'employment language'));
  }

  const auth = (email && email.authentication) || {};
  if (auth.available) {
    ['spf', 'dkim', 'dmarc'].forEach(function (name) {
      if (auth[name] === 'fail') findings.push(finding('authentication', name.toUpperCase() + ' failed', 'high', name + '=fail'));
    });
  }

  const unique = dedupe(findings);
  const scored = scoreFindings(unique);
  return {
    score: scored.score,
    riskLevel: scored.riskLevel,
    summary: summaryFor(scored, unique),
    findings: unique
  };
}

export function combineAssessments(ruleFindings, aiFindings) {
  const rules = dedupe(ruleFindings || []);
  const ai = dedupe(aiFindings || []).filter(function (item) {
    return !rules.some(function (rule) { return rule.title.toLowerCase() === item.title.toLowerCase(); });
  });
  const ruleScore = scoreFindings(rules).score;
  let merged = rules.concat(ai);
  let scored = scoreFindings(merged);
  if (ruleScore < 30) scored = scoreFindings(rules.concat(ai.map(function (item) {
    return Object.assign({}, item, { severity: item.severity === 'high' ? 'medium' : item.severity });
  })));
  if (ruleScore < 30) scored.score = Math.min(scored.score, ruleScore + 25);
  scored.riskLevel = scored.score >= 70 ? 'high' : scored.score >= 30 ? 'suspicious' : 'low';
  return {
    score: scored.score,
    riskLevel: scored.riskLevel,
    summary: summaryFor(scored, merged),
    findings: merged
  };
}

globalThis.PhishLensHeuristic = { assess: assess, combineAssessments: combineAssessments, registrableDomain: registrableDomain };
