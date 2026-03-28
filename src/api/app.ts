import path from 'path'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import helmet from '@fastify/helmet'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import staticFiles from '@fastify/static'
import { logger } from '../logger'
import { config } from '../config'
import dbPlugin from './plugins/db'
import redisPlugin from './plugins/redis'
import jwtPlugin from './plugins/jwt'
import s3Plugin from './plugins/s3'
import { requestIdHook } from './middleware/requestId'
import { registerAuthRoutes } from './modules/auth/auth.routes'
import { registerDemoRoutes } from './modules/demo/demo.routes'
import { registerHealthRoutes } from './health/health.routes'
import { AppError } from '../shared/types/errors'

export async function buildApp() {
  const app = Fastify({
    logger,
    genReqId: () => crypto.randomUUID(),
  })

  // Security headers (must be before static plugin)
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],   // inline scripts in index.html
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        connectSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
      },
    },
  })

  // CORS
  await app.register(cors, {
    origin: config.NODE_ENV === 'production' ? false : true,
    credentials: true,
  })

  // Cookie support
  await app.register(cookie)

  // Rate limiting — demo endpoint gets its own tighter limit via route config
  await app.register(rateLimit, {
    global: false,  // only apply where explicitly configured
    redis: undefined,  // will set per-route
  })

  // Serve public/ as static files (landing page)
  await app.register(staticFiles, {
    root: path.join(__dirname, '..', '..', 'public'),
    prefix: '/',
    decorateReply: false,
  })

  // Request ID middleware
  app.addHook('onRequest', requestIdHook)

  // Infrastructure plugins
  await app.register(dbPlugin)
  await app.register(redisPlugin)
  await app.register(jwtPlugin)
  await app.register(s3Plugin)

  // Routes
  await app.register(registerHealthRoutes)
  await app.register(registerAuthRoutes, { prefix: '/api/auth' })
  await app.register(registerDemoRoutes, { prefix: '/api/demo' })

  // Global error handler — convert AppError and Fastify validation errors to consistent JSON
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: { code: error.code, message: error.message },
      })
    }

    // Fastify validation error (JSON Schema)
    if (error.validation) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: error.message },
      })
    }

    app.log.error({ err: error }, 'Unhandled error')
    return reply.status(500).send({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    })
  })

  return app
}
