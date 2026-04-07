import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

const SSM_PREFIX = "/pm-governance";
const PARAM_OPENAI = `${SSM_PREFIX}/openai-api-key`;
const PARAM_ANTHROPIC = `${SSM_PREFIX}/anthropic-api-key`;
const PARAM_SMARTSHEET = `${SSM_PREFIX}/smartsheet-api-key`;

let openAIKey: string | undefined;
let anthropicKey: string | undefined;
let smartsheetKey: string | undefined;

async function fetchSSMParameter(name: string): Promise<string | undefined> {
  try {
    const client = new SSMClient({ region: process.env.AWS_REGION || "us-east-1" });
    const response = await client.send(
      new GetParameterCommand({ Name: name, WithDecryption: true }),
    );
    return response.Parameter?.Value || undefined;
  } catch (err: any) {
    if (err?.name !== "ParameterNotFound") {
      console.warn(`[secrets] Could not fetch SSM parameter "${name}":`, err?.message ?? err);
    }
    return undefined;
  }
}

export async function initSecrets(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    console.log("[secrets] Fetching API keys from AWS Parameter Store…");
    [openAIKey, anthropicKey, smartsheetKey] = await Promise.all([
      fetchSSMParameter(PARAM_OPENAI),
      fetchSSMParameter(PARAM_ANTHROPIC),
      fetchSSMParameter(PARAM_SMARTSHEET),
    ]);

    // Fall back to env vars if SSM params not found (useful during initial setup)
    if (!openAIKey && process.env.OPENAI_API_KEY) {
      openAIKey = process.env.OPENAI_API_KEY;
      console.warn("[secrets] OPENAI_API_KEY loaded from environment variable (set SSM parameter to use Parameter Store)");
    }
    if (!anthropicKey && process.env.ANTHROPIC_API_KEY) {
      anthropicKey = process.env.ANTHROPIC_API_KEY;
      console.warn("[secrets] ANTHROPIC_API_KEY loaded from environment variable (set SSM parameter to use Parameter Store)");
    }

    // Fall back to env vars for Smartsheet key
    if (!smartsheetKey && process.env.SMARTSHEET_API_KEY) {
      smartsheetKey = process.env.SMARTSHEET_API_KEY;
      console.warn("[secrets] SMARTSHEET_API_KEY loaded from environment variable");
    }

    if (openAIKey) console.log(`[secrets] OpenAI key loaded from ${openAIKey === process.env.OPENAI_API_KEY ? "environment" : "SSM"}`);
    if (anthropicKey) console.log(`[secrets] Anthropic key loaded from ${anthropicKey === process.env.ANTHROPIC_API_KEY ? "environment" : "SSM"}`);
    if (smartsheetKey) console.log("[secrets] Smartsheet key loaded from SSM");
    if (!openAIKey && !anthropicKey) {
      console.warn("[secrets] WARNING: No AI API keys found. Set SSM parameters or env vars before generating documents.");
    }
  } else {
    // Local dev: use env vars only
    openAIKey = process.env.OPENAI_API_KEY;
    anthropicKey = process.env.ANTHROPIC_API_KEY;
    smartsheetKey = process.env.SMARTSHEET_API_KEY;
  }
}

export const getOpenAIKey = (): string | undefined => openAIKey;
export const getAnthropicKey = (): string | undefined => anthropicKey;
export const hasOpenAIKey = (): boolean => !!openAIKey;
export const hasAnthropicKey = (): boolean => !!anthropicKey;
export const getSmartsheetKey = (): string | undefined => smartsheetKey;
export const hasSmartsheetKey = (): boolean => !!smartsheetKey;
