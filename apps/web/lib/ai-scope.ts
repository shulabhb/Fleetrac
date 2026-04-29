export type AiScopeId =
  | "all"
  | "production_ai"
  | "high_risk_regulated"
  | "customer_facing_agents"
  | "internal_copilots"
  | "security_sensitive_models"
  | "team_security"
  | "team_governance"
  | "team_operations"
  | "provider_openai"
  | "provider_anthropic"
  | "provider_google"
  | "provider_azure"
  | "provider_aws"
  | "env_production"
  | "env_staging";

export const AI_SCOPE_OPTIONS: Array<{ id: AiScopeId; label: string }> = [
  { id: "all", label: "All" },
  { id: "production_ai", label: "All production AI" },
  { id: "high_risk_regulated", label: "High-risk / regulated AI" },
  { id: "customer_facing_agents", label: "Customer-facing agents" },
  { id: "internal_copilots", label: "Internal copilots" },
  { id: "security_sensitive_models", label: "Security-sensitive models" },
  { id: "team_security", label: "Team: Security" },
  { id: "team_governance", label: "Team: Governance" },
  { id: "team_operations", label: "Team: Operations" },
  { id: "provider_openai", label: "Provider: OpenAI" },
  { id: "provider_anthropic", label: "Provider: Anthropic" },
  { id: "provider_google", label: "Provider: Google" },
  { id: "provider_azure", label: "Provider: Azure" },
  { id: "provider_aws", label: "Provider: AWS" },
  { id: "env_production", label: "Environment: Production" },
  { id: "env_staging", label: "Environment: Staging" }
];

export function normalizeAiScope(raw: string | null | undefined): AiScopeId {
  if (!raw) return "all";
  const valid = AI_SCOPE_OPTIONS.some((o) => o.id === raw);
  return valid ? (raw as AiScopeId) : "all";
}

function providerFromSystem(system: any): string {
  const hay = [
    system.model,
    system.model_name,
    system.modelType,
    system.model_type,
    system.hosting_environment,
    system.telemetry_archetype
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (hay.includes("gpt") || hay.includes("openai")) return "openai";
  if (hay.includes("claude") || hay.includes("anthropic")) return "anthropic";
  if (hay.includes("gemini") || hay.includes("google")) return "google";
  if (hay.includes("azure")) return "azure";
  if (hay.includes("aws") || hay.includes("bedrock")) return "aws";
  return "unknown";
}

function words(value: unknown): string {
  return String(value ?? "").toLowerCase().replace(/[_-]+/g, " ");
}

function hasAny(hay: string, needles: string[]): boolean {
  return needles.some((needle) => hay.includes(needle));
}

export function systemMatchesScope(system: any, scope: AiScopeId): boolean {
  if (scope === "all") return true;
  const env = words(system.environment);
  const owner = words(`${system.owner ?? ""} ${system.control_owner ?? ""}`);
  const useCase = words(system.use_case);
  const deploy = words(system.deployment_scope);
  const reg = words(system.regulatory_sensitivity);
  const biz = words(system.business_function);
  const modelType = words(system.model_type);
  const model = words(system.model ?? system.model_name);
  const provider = providerFromSystem(system);

  switch (scope) {
    case "production_ai":
      return env === "production";
    case "high_risk_regulated":
      return (
        hasAny(reg, ["regulated", "high", "pii", "critical", "sox", "hipaa", "pci"]) ||
        hasAny(biz, ["finance", "payments", "legal", "compliance", "security"])
      );
    case "customer_facing_agents":
      return (
        hasAny(deploy, ["customer", "external", "public", "consumer"]) ||
        hasAny(useCase, ["agent", "assistant", "support", "chat"]) ||
        hasAny(modelType, ["agent"])
      );
    case "internal_copilots":
      return (
        hasAny(useCase, ["copilot", "assistant", "productivity"]) ||
        hasAny(deploy, ["internal", "employee", "ops"]) ||
        hasAny(modelType, ["copilot"])
      );
    case "security_sensitive_models":
      return (
        hasAny(biz, ["security", "fraud", "risk", "identity", "threat"]) ||
        hasAny(reg, ["security", "sensitive", "regulated", "critical"]) ||
        hasAny(useCase, ["fraud", "security", "soc"])
      );
    case "team_security":
      return hasAny(owner, ["security", "soc", "cyber"]);
    case "team_governance":
      return hasAny(owner, ["governance", "compliance", "risk"]);
    case "team_operations":
      return hasAny(owner, ["ops", "operations", "platform", "reliability", "sre"]);
    case "provider_openai":
      return provider === "openai" || hasAny(model, ["gpt", "openai"]);
    case "provider_anthropic":
      return provider === "anthropic" || hasAny(model, ["claude", "anthropic"]);
    case "provider_google":
      return provider === "google" || hasAny(model, ["gemini", "google"]);
    case "provider_azure":
      return provider === "azure" || hasAny(model, ["azure"]);
    case "provider_aws":
      return provider === "aws" || hasAny(model, ["bedrock", "titan", "aws"]);
    case "env_production":
      return env === "production";
    case "env_staging":
      return env === "staging" || hasAny(deploy, ["staging", "pilot", "preprod"]);
    default:
      return true;
  }
}

export function withAiScope(href: string, scope: AiScopeId): string {
  if (scope === "all") return href;
  const [path, qs = ""] = href.split("?");
  const params = new URLSearchParams(qs);
  params.set("scope", scope);
  const out = params.toString();
  return out ? `${path}?${out}` : path;
}

