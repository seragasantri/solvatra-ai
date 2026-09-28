// Factory: pilih adapter provider berdasarkan config.provider.
import { config, activeProvider } from "../config.js";
import { createProvider as createAnthropic } from "./anthropic.js";
import { createProvider as createOpenAICompat } from "./openaiCompat.js";

export function getProvider() {
  const pconf = activeProvider();
  if (config.provider === "claude") return createAnthropic(pconf);
  // codex & custom sama-sama OpenAI-compatible.
  return createOpenAICompat(pconf);
}
