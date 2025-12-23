import process from "node:process";

async function checkAnthropic() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, error: "ANTHROPIC_API_KEY missing" };

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 8,
      messages: [{ role: "user", content: "Ping" }],
    }),
  });

  if (!response.ok) {
    return { ok: false, error: `Anthropic ${response.status}: ${await response.text()}` };
  }

  return { ok: true };
}

async function checkXai() {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return { ok: false, error: "XAI_API_KEY missing" };

  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "grok-2-latest",
      messages: [{ role: "user", content: "Ping" }],
      max_tokens: 8,
    }),
  });

  if (!response.ok) {
    return { ok: false, error: `xAI ${response.status}: ${await response.text()}` };
  }

  return { ok: true };
}

const anthropic = await checkAnthropic();
const xai = await checkXai();

console.log(JSON.stringify({ anthropic, xai }, null, 2));
