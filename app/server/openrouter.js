const REQUIRED_ENV_VARS = [
  'OPENROUTER_BASE_URL',
  'OPENROUTER_API_KEY',
  'OPENROUTER_MODEL',
];

const SYSTEM_PROMPT = `You are Thread Surgeon, an AI operator that extracts execution clarity from messy team conversations.
Return only valid JSON with no markdown fences or extra commentary.

Required JSON shape:
{
  "summary": "1-3 sentence summary",
  "heat_score": 0,
  "urgency_label": "Calm | Warm | Hot | Critical",
  "decisions": [
    {
      "title": "short decision",
      "detail": "what was decided",
      "confidence": "high | medium | low"
    }
  ],
  "unresolved_questions": [
    {
      "question": "what still needs an answer",
      "why_it_matters": "impact if unanswered"
    }
  ],
  "contradictions": [
    {
      "topic": "area of disagreement",
      "side_a": "first position",
      "side_b": "conflicting position",
      "risk": "why this conflict matters"
    }
  ],
  "owners": [
    {
      "owner": "person or team",
      "responsibility": "what they own",
      "status": "assigned | blocked | unclear"
    }
  ],
  "missing_owners": [
    {
      "responsibility": "what has no clear owner",
      "impact": "why it is risky"
    }
  ],
  "risks": [
    "short risk statement"
  ],
  "suggested_reply_markdown": "a concise, ready-to-send reply in markdown"
}

Rules:
- Base everything only on the provided thread.
- Use short, concrete phrasing.
- If something is missing, return an empty array instead of inventing facts.
- heat_score must be an integer from 0 to 100.
- suggested_reply_markdown should sound like a capable teammate unblocking the thread.`;

export function getOpenRouterStatus() {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);

  return {
    configured: missing.length === 0,
    missing,
    model: process.env.OPENROUTER_MODEL || null,
  };
}

export async function analyzeThread(thread) {
  const status = getOpenRouterStatus();

  if (!status.configured) {
    const error = new Error(
      `Missing required OpenRouter env vars: ${status.missing.join(', ')}`,
    );
    error.statusCode = 503;
    throw error;
  }

  const baseUrl = process.env.OPENROUTER_BASE_URL.replace(/\/$/, '');
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL,
      temperature: 0.2,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Analyze this thread and return JSON only.\n\nTHREAD:\n${thread}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    const error = new Error(
      `OpenRouter request failed (${response.status} ${response.statusText}): ${details.slice(0, 600)}`,
    );
    error.statusCode = 502;
    throw error;
  }

  const payload = await response.json();
  const rawContent = getMessageText(payload);

  if (!rawContent) {
    const error = new Error('OpenRouter returned an empty completion.');
    error.statusCode = 502;
    throw error;
  }

  const parsed = parseJsonResponse(rawContent);

  return {
    model: payload.model || process.env.OPENROUTER_MODEL,
    usage: payload.usage || null,
    result: normalizeResult(parsed),
  };
}

function getMessageText(payload) {
  const content = payload?.choices?.[0]?.message?.content;

  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') {
          return part;
        }

        return part?.text || part?.content || '';
      })
      .join('');
  }

  return '';
}

function parseJsonResponse(rawText) {
  const cleaned = rawText.trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const candidate = extractFirstJsonObject(cleaned);

    if (!candidate) {
      const error = new Error('The AI response was not valid JSON.');
      error.statusCode = 502;
      throw error;
    }

    try {
      return JSON.parse(candidate);
    } catch {
      const error = new Error('The AI response JSON could not be parsed.');
      error.statusCode = 502;
      throw error;
    }
  }
}

function extractFirstJsonObject(text) {
  let start = -1;
  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (start === -1) {
      if (char === '{') {
        start = index;
        depth = 1;
      }
      continue;
    }

    if (inString) {
      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === '\\') {
        escapeNext = true;
        continue;
      }

      if (char === '"') {
        inString = false;
      }

      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') {
      depth += 1;
    }

    if (char === '}') {
      depth -= 1;

      if (depth === 0) {
        return text.slice(start, index + 1);
      }
    }
  }

  return null;
}

function normalizeResult(payload) {
  const heatScore = clampInteger(payload?.heat_score ?? payload?.heatScore, 0, 100, 50);

  return {
    summary: asText(payload?.summary),
    heatScore,
    urgencyLabel: asText(payload?.urgency_label ?? payload?.urgencyLabel) || labelFromHeat(heatScore),
    decisions: ensureArray(payload?.decisions).map(normalizeDecision),
    unresolvedQuestions: ensureArray(payload?.unresolved_questions ?? payload?.unresolvedQuestions).map(
      normalizeQuestion,
    ),
    contradictions: ensureArray(payload?.contradictions).map(normalizeContradiction),
    owners: ensureArray(payload?.owners).map(normalizeOwner),
    missingOwners: ensureArray(payload?.missing_owners ?? payload?.missingOwners).map(
      normalizeMissingOwner,
    ),
    risks: ensureArray(payload?.risks)
      .map((risk) => asText(risk))
      .filter(Boolean),
    suggestedReplyMarkdown:
      asText(payload?.suggested_reply_markdown ?? payload?.suggestedReplyMarkdown) ||
      'I pulled the thread into a clearer action plan above. Let me know if you want me to tailor the reply for leadership or the working team.',
  };
}

function normalizeDecision(item) {
  if (typeof item === 'string') {
    return {
      title: item,
      detail: '',
      confidence: 'medium',
    };
  }

  return {
    title: asText(item?.title),
    detail: asText(item?.detail),
    confidence: normalizeConfidence(item?.confidence),
  };
}

function normalizeQuestion(item) {
  if (typeof item === 'string') {
    return {
      question: item,
      whyItMatters: '',
    };
  }

  return {
    question: asText(item?.question),
    whyItMatters: asText(item?.why_it_matters ?? item?.whyItMatters),
  };
}

function normalizeContradiction(item) {
  if (typeof item === 'string') {
    return {
      topic: item,
      sideA: '',
      sideB: '',
      risk: '',
    };
  }

  return {
    topic: asText(item?.topic),
    sideA: asText(item?.side_a ?? item?.sideA),
    sideB: asText(item?.side_b ?? item?.sideB),
    risk: asText(item?.risk),
  };
}

function normalizeOwner(item) {
  if (typeof item === 'string') {
    return {
      owner: item,
      responsibility: '',
      status: 'unclear',
    };
  }

  return {
    owner: asText(item?.owner),
    responsibility: asText(item?.responsibility),
    status: normalizeOwnerStatus(item?.status),
  };
}

function normalizeMissingOwner(item) {
  if (typeof item === 'string') {
    return {
      responsibility: item,
      impact: '',
    };
  }

  return {
    responsibility: asText(item?.responsibility),
    impact: asText(item?.impact),
  };
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function asText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function clampInteger(value, min, max, fallback) {
  const numeric = Number.parseInt(value, 10);

  if (Number.isNaN(numeric)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, numeric));
}

function normalizeConfidence(value) {
  const normalized = asText(value).toLowerCase();
  return ['high', 'medium', 'low'].includes(normalized) ? normalized : 'medium';
}

function normalizeOwnerStatus(value) {
  const normalized = asText(value).toLowerCase();
  return ['assigned', 'blocked', 'unclear'].includes(normalized) ? normalized : 'unclear';
}

function labelFromHeat(score) {
  if (score >= 85) {
    return 'Critical';
  }
  if (score >= 65) {
    return 'Hot';
  }
  if (score >= 35) {
    return 'Warm';
  }
  return 'Calm';
}
