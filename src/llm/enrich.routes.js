import express from 'express';
import { enrichInputSchema, enrichOutputSchema } from './schema.js';
import { enrichBookWithModel } from './model.js';

function stubEnrichment(input) {
  const missingDescription = input.description === null || input.description.trim() === '';
  const output = {
    category: 'other',
    summary: missingDescription
      ? `The book is titled "${input.title}"; no description was provided.`
      : `The book is titled "${input.title}" and has a description, but its category is unclear.`,
    quality_flags: missingDescription ? ['missing_description', 'unclear_category'] : ['unclear_category'],
  };

  return enrichOutputSchema.parse(output);
}

export function createEnrichRouter({
  isStub = () => process.env.LLM_STUB === '1',
  modelCall = enrichBookWithModel,
} = {}) {
  const router = express.Router();

  router.post('/enrich', async (request, response) => {
    const inputResult = enrichInputSchema.safeParse(request.body);
    if (!inputResult.success) {
      const fieldErrors = inputResult.error.flatten().fieldErrors;
      return response.status(400).json({ error: 'Invalid input', fields: fieldErrors });
    }

    if (isStub()) {
      return response.status(200).json(stubEnrichment(inputResult.data));
    }

    try {
      const modelOutput = await modelCall(inputResult.data);
      const outputResult = enrichOutputSchema.safeParse(modelOutput);
      if (!outputResult.success) {
        return response.status(502).json({ error: 'Model response failed schema validation' });
      }
      return response.status(200).json(outputResult.data);
    } catch {
      return response.status(502).json({ error: 'Model request failed' });
    }
  });

  return router;
}