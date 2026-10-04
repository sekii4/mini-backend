import OpenAI from 'openai';

const { LLM_BASE_URL: baseURL, LLM_API_KEY: apiKey, LLM_MODEL: model } = process.env;

if (!baseURL || !apiKey || !model) {
  throw new Error('Set LLM_BASE_URL, LLM_API_KEY, and LLM_MODEL in .env before running the provider check.');
}

const client = new OpenAI({ baseURL, apiKey });
const response = await client.chat.completions.create({
  model,
  temperature: 0,
  messages: [{ role: 'user', content: 'Reply with exactly the word: ready' }],
});

const answer = response.choices[0]?.message?.content?.trim();
if (!answer) throw new Error('The provider returned an empty response.');
console.log(answer);