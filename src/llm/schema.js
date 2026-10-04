import { z } from 'zod';

export const enrichInputSchema = z.object({
  title: z.string().trim().min(1, 'title is required').max(200, 'title must be at most 200 characters'),
  description: z.string().max(5000, 'description must be at most 5000 characters').nullable(),
}).strict();

export const enrichOutputSchema = z.object({
  category: z.enum(['fiction', 'nonfiction', 'poetry', 'children', 'other']),
  summary: z.string().trim().min(1).max(300),
  quality_flags: z.array(z.enum([
    'missing_description',
    'unclear_category',
    'sparse_description',
    'unverified_details',
  ])).refine((flags) => new Set(flags).size === flags.length, {
    message: 'quality_flags must not contain duplicates',
  }),
}).strict();