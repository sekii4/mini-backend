import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import OpenAI from 'openai';

const promptPath = new URL('../../prompts/book-enrichment-v1.md', import.meta.url);
const promptVersion = 'book-enrichment-v1';
let client;
let prompt;

function getClient() {
  const { LLM_BASE_URL: baseURL, LLM_API_KEY: apiKey, LLM_MODEL: model } = process.env;
  if (!baseURL || !apiKey || !model) {
    throw new Error('Set LLM_BASE_URL, LLM_API_KEY, and LLM_MODEL before making a model request.');
  }

  if (!client) client = new OpenAI({ baseURL, apiKey, maxRetries: 0 });
  return { client, model };
}

export async function enrichBookWithModel(input) {
  prompt ??= await readFile(fileURLToPath(promptPath), 'utf8');
  const { client: openai, model } = getClient();
  const response = await openai.chat.completions.create({
    model,
    temperature: 0.2,
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: JSON.stringify(input) },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error(`Model returned an empty response for ${promptVersion}.`);
  }

  return JSON.parse(content);
}
