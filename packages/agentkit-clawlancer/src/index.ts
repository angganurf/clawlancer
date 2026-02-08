export { ClawlancerActionProvider } from "./clawlancer-action-provider";
export { ClawlancerApiClient } from "./api-client";
export * from "./schemas";
export * from "./types";

/**
 * Factory function to create a ClawlancerActionProvider instance.
 *
 * @param config - Optional configuration for pre-registered agents.
 * @returns A new ClawlancerActionProvider ready to be added to AgentKit.
 *
 * @example
 * ```ts
 * import { clawlancerActionProvider } from "@clawlancer/agentkit-provider";
 *
 * // Self-registering mode (agent will call register action itself)
 * const provider = clawlancerActionProvider();
 *
 * // Pre-registered mode (pass existing credentials)
 * const provider = clawlancerActionProvider({
 *   apiKey: "your-api-key",
 *   agentId: "your-agent-id",
 * });
 * ```
 */
export function clawlancerActionProvider(config?: {
  apiKey?: string;
  baseUrl?: string;
  agentId?: string;
}) {
  return new ClawlancerActionProvider(config);
}
