import { z } from 'zod'

/*
 * El contrato de datos del factory. Todo lo que el intake LLM produce y el
 * provisioning consume pasa por aquí. capabilities/limits NO existen en este
 * contrato a propósito: los fija el plan, server-side (abi.provision_tenant).
 */

export const SLUG_RE = /^[a-z][a-z0-9-]{2,29}$/

export const botSpecSchema = z
  .object({
    business_name: z.string().min(2).max(120),
    vertical: z
      .string()
      .regex(/^[a-z][a-z_-]{1,30}$/)
      .catch('general'),
    slug: z.string().regex(SLUG_RE).optional(),
    persona: z
      .object({
        bot_name: z.string().max(80).optional(),
        tone: z.array(z.string().max(30)).max(5).catch(['cercano']),
        greeting: z.string().max(300).optional(),
        overrides: z.record(z.string(), z.string().max(500)).optional(),
      })
      .partial()
      .catch({}),
    objectives: z.array(z.string().max(60)).max(8).catch([]),
    knowledge_text: z.string().max(20000).catch(''),
    contact: z
      .object({
        name: z.string().max(120).optional(),
        email: z.string().email().max(200).optional(),
        phone: z.string().max(30).optional(),
      })
      .partial()
      .catch({}),
    language: z.enum(['es', 'en']).catch('es'),
  })
  .strip()

export type BotSpec = z.infer<typeof botSpecSchema>
