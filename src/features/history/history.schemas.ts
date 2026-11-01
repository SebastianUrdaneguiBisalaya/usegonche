import { z } from 'zod';
import { paginationQuery } from '../../lib/pagination.js';

export const historyQuerySchema = z.object(paginationQuery);
export const historyParamSchema = z.object({ id: z.uuid() });
