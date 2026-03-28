import type { FastifyPluginAsync } from 'fastify'
import { config } from '../../../config'
import { AppError, ErrorCode } from '../../../shared/types/errors'

interface DemoFillBody {
  profile: string
  document: string
}

interface FilledField {
  label: string
  value: string
}

interface FillResult {
  fields: FilledField[]
  summary: string
}

export const registerDemoRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: DemoFillBody }>(
    '/fill',
    {
      config: {
        rateLimit: {
          max: config.DEMO_RATE_LIMIT_MAX,
          timeWindow: config.DEMO_RATE_LIMIT_WINDOW_MS,
        },
      },
      schema: {
        body: {
          type: 'object',
          required: ['profile', 'document'],
          additionalProperties: false,
          properties: {
            profile: { type: 'string', minLength: 10, maxLength: 4000 },
            document: { type: 'string', minLength: 1, maxLength: 4000 },
          },
        },
      },
    },
    async (request, reply) => {
      if (!config.ANTHROPIC_API_KEY) {
        throw new AppError(
          ErrorCode.INTERNAL_ERROR,
          'Demo is not configured on this server.',
          503,
        )
      }

      const { profile, document: docText } = request.body

      const prompt = `You are a document autofill assistant. Given a user's personal profile and a document, extract fields that need to be filled in and fill them from the profile.

USER PROFILE:
${profile}

DOCUMENT CONTENT:
${docText}

Instructions:
1. Identify up to 10 key fields in the document that can be filled from the profile.
2. Return ONLY a JSON object (no markdown, no preamble) with this exact shape:
{"fields":[{"label":"Field name","value":"Filled value"}],"summary":"One sentence describing what was filled."}

If the document has no clear fields, infer what fields a document of this type typically has and fill those from the profile.`

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }],
        }),
      })

      if (!res.ok) {
        request.log.error({ status: res.status }, 'Anthropic API error in demo fill')
        throw new AppError(ErrorCode.INTERNAL_ERROR, 'Failed to process document.', 502)
      }

      const apiData = (await res.json()) as {
        content: Array<{ type: string; text?: string }>
      }

      const raw = apiData.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text ?? '')
        .join('')

      let parsed: FillResult
      try {
        const clean = raw.replace(/```json|```/g, '').trim()
        parsed = JSON.parse(clean) as FillResult
      } catch {
        request.log.warn({ raw }, 'Failed to parse Claude response in demo')
        throw new AppError(ErrorCode.INTERNAL_ERROR, 'Could not parse the response.', 502)
      }

      return reply.status(200).send(parsed)
    },
  )
}
