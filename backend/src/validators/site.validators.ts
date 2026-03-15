import { z } from "zod";

export const createSiteSchema = z.object({
  key: z.string().min(1).max(100).regex(/^[a-z0-9_-]+$/, "Key must be lowercase alphanumeric with hyphens/underscores"),
  name: z.string().min(1).max(200),
  baseUrl: z.string().url(),
  enabled: z.boolean().optional().default(true),
  parser: z.string().optional().default("universal"),
  listPaths: z.array(z.string()).optional().default([]),
  selectors: z.any().optional(),
  detailSelectors: z.any().optional(),
  paginationType: z.enum(["auto", "next_button", "page_number", "infinite_scroll", "load_more"]).optional().default("auto"),
  maxPages: z.number().int().min(1).max(200).optional().default(30),
  requiresBrowser: z.boolean().optional().default(false),
  customHeaders: z.any().optional(),
});

export const updateSiteSchema = createSiteSchema.partial().omit({ key: true });

export const listSitesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  enabled: z.coerce.boolean().optional(),
  search: z.string().optional(),
});

export type CreateSiteInput = z.infer<typeof createSiteSchema>;
export type UpdateSiteInput = z.infer<typeof updateSiteSchema>;
