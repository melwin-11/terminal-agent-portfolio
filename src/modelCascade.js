const COOLDOWN_MS = 60_000;
const coolingUntil = new Map();

export function configuredModels(primary, fallbacks = []) {
  return [...new Set([primary, ...fallbacks].filter(Boolean))];
}

export function isFallbackError(error) {
  if (error?.name === "AbortError") return false;
  const message = String(error?.message ?? error);
  if (/timed out|did not respond within|timeout|aborted/i.test(message)) return true;
  if (/\((?:429|5\d\d)\)/.test(message)) return true;
  return /\(404\)/.test(message) && /model/i.test(message) && /not found|not supported|does not exist/i.test(message);
}

export async function withModelFallback(models, execute) {
  const now = Date.now();
  const ready = models.filter((model) => (coolingUntil.get(model) ?? 0) <= now);
  if (!ready.length) {
    throw new Error("All configured Gemini models recently failed and are cooling down. Please try again in a minute.");
  }

  let lastError;
  for (const model of ready) {
    try {
      return await execute(model);
    } catch (error) {
      if (!isFallbackError(error)) throw error;
      coolingUntil.set(model, Date.now() + COOLDOWN_MS);
      lastError = error;
    }
  }
  throw lastError;
}
