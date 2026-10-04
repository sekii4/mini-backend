import express from 'express';
import { enrichInputSchema, enrichOutputSchema } from './schema.js';
import { enrichBookWithModel, promptVersion, repairBookEnrichment } from './model.js';
import { writeQuarantineEntry } from './quarantine.js';

function parseModelJson(rawOutput) {
  if (typeof rawOutput !== 'string') throw new Error('Model response was not text.');

  let candidate = rawOutput.trim();
  const fenced = candidate.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) candidate = fenced[1].trim();

  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace < firstBrace) {
    throw new Error('Model response did not contain a JSON object.');
  }

  return JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
}

function validateModelJson(rawOutput) {
  let parsed;
  try {
    parsed = parseModelJson(rawOutput);
  } catch (error) {
    return { success: false, error: `JSON parse error: ${error.message}` };
  }

  const result = enrichOutputSchema.safeParse(parsed);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'response'}: ${issue.message}`)
      .join('; ');
    return { success: false, error: `Schema validation error: ${details}` };
  }

  return { success: true, data: result.data };
}

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
  repairCall = repairBookEnrichment,
  quarantine = writeQuarantineEntry,
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
      const originalInput = inputResult.data;
      const originalOutput = await modelCall(originalInput);
      const firstValidation = validateModelJson(originalOutput);
      if (firstValidation.success) {
        return response.status(200).json(firstValidation.data);
      }

      let repairedOutput;
      let repairError;
      try {
        repairedOutput = await repairCall({
          input: originalInput,
          brokenOutput: originalOutput,
          validationError: firstValidation.error,
        });
      } catch (error) {
        repairError = `Repair request failed: ${error.message}`;
      }

      const repairedValidation = repairError
        ? { success: false, error: repairError }
        : validateModelJson(repairedOutput);

      if (!repairedValidation.success) {
        const validationError = `${firstValidation.error}; repair failed: ${repairedValidation.error}`;
        try {
          await quarantine({
            input: originalInput,
            error: validationError,
            prompt_version: promptVersion,
            raw_model_output: originalOutput,
            repair_model_output: repairedOutput ?? null,
          });
        } catch (error) {
          console.error(`Unable to quarantine failed model response: ${error.message}`);
        }

        return response.status(422).json({ error: 'Model response could not be validated after one repair attempt' });
      }

      return response.status(200).json(repairedValidation.data);
    } catch {
      return response.status(502).json({ error: 'Model request failed' });
    }
  });

  return router;
}