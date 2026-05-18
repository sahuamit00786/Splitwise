// /server/src/middleware/validate.js
import { ZodError } from 'zod';
import { error } from '../utils/response.js';

/**
 * Validate request data using Zod schema
 * @param {import('zod').ZodSchema} schema - Zod schema
 * @param {'body' | 'query' | 'params'} source - Request data source
 */
export function validate(schema, source = 'body') {
  return (req, res, next) => {
    try {
      const validatedData = schema.parse(req[source]);
      req[source] = validatedData;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const errors = err.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message
        }));
        return error(res, 'Validation failed', 400, errors);
      }
      return error(res, 'Invalid request data', 400);
    }
  };
}
