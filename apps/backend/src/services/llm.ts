import { aiEnabled, config } from '../config';
import { limiter } from '../lib/cache';
import { AppError } from '../lib/http';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatOptions {
  /** Overall time budget across every model in the chain. */
  budgetMs?: number;
  temperature?: number;
  maxTokens?: number;
  /** 'fast' tries the non-reasoning models first (interactive features). */
  priority?: 'quality' | 'fast';
}


/** Models that just failed (rate limit / outage) are skipped for a while. */
const cooldownUntil = new Map<string, number>();
const COOLDOWN_MS = 90_000;

export function extractJson<T = unknown>(text: string): T {
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/```(?:json)?/gi, '').trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    /* fall through to bracket scanning */
  }
  const starts = ['{', '['].map((c) => cleaned.indexOf(c)).filter((i) => i >= 0);
  if (!starts.length) throw new Error('No JSON found in model output');
  const start = Math.min(...starts);
  const close = cleaned[start] === '{' ? '}' : ']';
  const end = cleaned.lastIndexOf(close);
  if (end <= start) throw new Error('Unterminated JSON in model output');
  return JSON.parse(cleaned.slice(start, end + 1)) as T;
}

/**
 * Calls the OpenRouter model chain and returns parsed JSON.
 * The configured models are reasoning models; reasoning is disabled on purpose
 * (see the request body) because it made latency unpredictable.
 */
export async function chatJson<T>(messages: ChatMessage[], opts: ChatOptions = {}): Promise<{ data: T; model: string }> {
  if (!aiEnabled()) throw new AppError(503, "L'IA n'est pas configurée", 'AI_DISABLED');

  return llmSlots(() => runChain<T>(messages, opts));
}

/** Free OpenRouter models queue concurrent requests: cap our parallelism. */
const llmSlots = limiter(3);

/**
 * Adaptive routing: we remember each model's real latency (EWMA) and, for
 * interactive calls, try the fastest healthy model first. Background work
 * (home mixes) keeps the configured "quality" order.
 */
const latencyMs = new Map<string, number>();

function recordLatency(model: string, ms: number) {
  const prev = latencyMs.get(model);
  latencyMs.set(model, prev === undefined ? ms : prev * 0.6 + ms * 0.4);
}

export function orderModels(models: string[], priority: 'quality' | 'fast', fastHints: string[] = [], midHints: string[] = []): string[] {
  if (priority === 'quality') return models;
  // Models never measured yet get a prior: non-reasoning first, then the light reasoning one.
  const prior = (m: string) => (fastHints.includes(m) ? 5_000 : midHints.includes(m) ? 15_000 : 40_000) + models.indexOf(m);
  return [...models].sort((a, b) => (latencyMs.get(a) ?? prior(a)) - (latencyMs.get(b) ?? prior(b)));
}

async function runChain<T>(messages: ChatMessage[], opts: ChatOptions): Promise<{ data: T; model: string }> {
  const deadline = Date.now() + (opts.budgetMs ?? config.ai.timeoutMs);
  const now = Date.now();
  const available = config.ai.models.filter((m) => (cooldownUntil.get(m) ?? 0) < now);
  if (!available.length && aiPausedUntil()) {
    throw new AppError(503, "L'IA est en pause (quota du jour atteint)", 'AI_UNAVAILABLE');
  }
  const fastHints = [config.ai.fastModel, config.ai.altModel].filter((m): m is string => !!m);
  const chain = orderModels(available.length ? available : config.ai.models, opts.priority ?? 'quality', fastHints, [config.ai.fallbackModel ?? '']);
  const errors: string[] = [];

  for (const [i, model] of chain.entries()) {
    const remaining = deadline - Date.now();
    if (remaining < 3000) break;
    // Leave time for the fallbacks: one slow model must not eat the whole budget.
    const slice = i === chain.length - 1 ? remaining : Math.floor(Math.max(8000, remaining * 0.6));
    const started = Date.now();
    try {
      const res = await fetch(`${config.ai.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.ai.apiKey}`,
          'HTTP-Referer': config.frontendUrl,
          'X-Title': 'FEO Music',
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: opts.temperature ?? 0.7,
          max_tokens: opts.maxTokens ?? 3500,
          // Curation needs no chain-of-thought. With reasoning on (even "low"),
          // these models randomly reason for 7k+ tokens (~90 s) before answering;
          // disabled, they answer reliably in 7–15 s.
          reasoning: { enabled: false },
          response_format: { type: 'json_object' },
        }),
        signal: AbortSignal.timeout(slice),
      });

      if (!res.ok) {
        const reset = Number(res.headers.get('x-ratelimit-reset'));
        if (res.status === 429 && res.headers.get('x-ratelimit-remaining') === '0' && reset > Date.now()) {
          // Daily free-model quota is account-wide: pause every ":free" model until it resets,
          // so users get the instant non-AI fallback instead of waiting on doomed calls.
          for (const m of config.ai.models) if (m.endsWith(':free')) cooldownUntil.set(m, reset);
          await res.body?.cancel();
          errors.push(`${model}: daily free quota reached`);
          continue;
        }
        if (res.status === 429 || res.status >= 500) cooldownUntil.set(model, Date.now() + COOLDOWN_MS);
        errors.push(`${model}: HTTP ${res.status}`);
        continue;
      }

      const body: any = await res.json();
      const content: string | null = body.choices?.[0]?.message?.content ?? null;
      if (!content) {
        errors.push(`${model}: empty content (${body.choices?.[0]?.finish_reason ?? 'unknown'})`);
        continue;
      }
      const data = extractJson<T>(content);
      recordLatency(model, Date.now() - started);
      return { data, model };
    } catch (err) {
      const timedOut = (err as Error).name === 'TimeoutError';
      if (timedOut) recordLatency(model, slice * 1.5); // push slow models down the fast chain
      errors.push(`${model}: ${timedOut ? 'timeout' : (err as Error).message}`);
    }
  }

  console.warn('[llm] all models failed:', errors.join(' | '));
  throw new AppError(503, "L'IA est momentanément indisponible", 'AI_UNAVAILABLE');
}

/** When every model is paused for a long time (daily quota), returns when AI comes back. */
export function aiPausedUntil(): string | null {
  const now = Date.now();
  const until = Math.min(...config.ai.models.map((m) => cooldownUntil.get(m) ?? 0));
  return until > now + COOLDOWN_MS ? new Date(until).toISOString() : null;
}

/* ---------- per-user daily quota ---------- */
const usage = new Map<string, { day: string; count: number }>();

export function consumeAiQuota(userId: string) {
  const day = new Date().toISOString().slice(0, 10);
  const entry = usage.get(userId);
  const count = entry && entry.day === day ? entry.count : 0;
  if (count >= config.ai.dailyLimitPerUser) {
    throw new AppError(429, "Limite quotidienne d'IA atteinte, réessaie demain", 'AI_QUOTA');
  }
  usage.set(userId, { day, count: count + 1 });
}
