import { createHash, randomBytes, randomUUID } from 'node:crypto';

import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { hash, verify } from '@node-rs/argon2';
import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from 'fastify';
import { z } from 'zod';

import { privacyHtml, termsHtml } from './legal.js';
import type { JsonObject, PoraStore, UserRecord } from './store/Store.js';
import { toPublicUser } from './store/Store.js';

export interface AppConfig {
  appEnv: 'development' | 'test' | 'production';
  jwtSecret: string;
  jwtIssuer: string;
  jwtAudience: string;
  accessTokenTtl: string;
  refreshTokenTtlDays: number;
  corsOrigins: string[];
}

interface BuildAppOptions {
  config: AppConfig;
  store: PoraStore;
  now?: () => Date;
  logger?: boolean;
}

const registerSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(12).max(128),
  displayName: z.string().trim().min(1).max(80).optional(),
});
const loginSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(1).max(128),
});
const recoverSchema = z.object({
  email: z.string().trim().email().max(320),
  recoveryCode: z.string().trim().min(20).max(128),
  newPassword: z.string().min(12).max(128),
});
const refreshSchema = z.object({
  refreshToken: z.string().min(32).max(512),
});
const syncEventSchema = z.object({
  id: z.string().min(1).max(128),
  type: z.string().min(1).max(64),
  aggregateId: z.string().min(1).max(128),
  occurredAt: z.iso.datetime({ offset: true }),
  payload: z.record(z.string(), z.unknown()),
});
const pushEventsSchema = z.object({
  deviceId: z.string().min(1).max(128),
  events: z.array(syncEventSchema).min(1).max(500),
});
const pullEventsSchema = z.object({
  after: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

function normalizeEmail(email: string) {
  return email.trim().toLocaleLowerCase('en-US');
}

function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function accessTokenSeconds(value: string) {
  const match = /^(\d+)([smh])$/.exec(value);
  if (!match) return 900;
  const amount = Number(match[1]);
  const multiplier = match[2] === 'h' ? 3600 : match[2] === 'm' ? 60 : 1;
  return amount * multiplier;
}

function sendError(
  reply: FastifyReply,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown,
) {
  return reply.code(statusCode).send({
    error: {
      code,
      message,
      ...(details === undefined ? {} : { details }),
    },
  });
}

export async function buildApp(options: BuildAppOptions) {
  const { config, store } = options;
  const clock = options.now ?? (() => new Date());
  const app = Fastify({
    logger: options.logger ?? false,
    trustProxy: true,
    bodyLimit: 512 * 1024,
  });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: config.corsOrigins.length > 0 ? config.corsOrigins : false,
  });
  await app.register(rateLimit, { global: false });
  await app.register(jwt, {
    secret: config.jwtSecret,
    sign: { iss: config.jwtIssuer, aud: config.jwtAudience },
    verify: {
      allowedIss: config.jwtIssuer,
      allowedAud: config.jwtAudience,
    },
  });

  const passwordOptions = {
    algorithm: 2,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  } as const;
  const dummyPasswordHash = await hash(
    'this-password-is-never-valid',
    passwordOptions,
  );

  async function createSession(user: UserRecord, familyId = randomUUID()) {
    const now = clock();
    const refreshToken = randomBytes(32).toString('base64url');
    await store.createRefreshToken({
      tokenHash: tokenHash(refreshToken),
      userId: user.id,
      familyId,
      expiresAt: new Date(
        now.getTime() + config.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
      ),
      createdAt: now,
    });
    return {
      user: toPublicUser(user),
      accessToken: app.jwt.sign({ sub: user.id }, { expiresIn: config.accessTokenTtl }),
      refreshToken,
      expiresIn: accessTokenSeconds(config.accessTokenTtl),
    };
  }

  async function requireUser(request: FastifyRequest, reply: FastifyReply) {
    try {
      await request.jwtVerify<{ sub: string }>();
    } catch {
      return sendError(reply, 401, 'UNAUTHORIZED', 'Требуется вход в аккаунт');
    }
  }

  function currentUserId(request: FastifyRequest) {
    return (request.user as { sub: string }).sub;
  }

  app.get('/health', async () => {
    await store.ping();
    return { status: 'ok' };
  });

  app.get('/legal/privacy', async (_request, reply) =>
    reply.type('text/html; charset=utf-8').send(privacyHtml),
  );
  app.get('/legal/terms', async (_request, reply) =>
    reply.type('text/html; charset=utf-8').send(termsHtml),
  );

  app.post(
    '/v1/auth/register',
    { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const parsed = registerSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendError(
          reply,
          400,
          'VALIDATION_ERROR',
          'Проверьте данные регистрации',
          parsed.error.flatten(),
        );
      }
      const passwordHash = await hash(parsed.data.password, passwordOptions);
      const recoveryCode = randomBytes(18).toString('base64url');
      const user = await store.createUser({
        email: normalizeEmail(parsed.data.email),
        passwordHash,
        recoveryCodeHash: tokenHash(recoveryCode),
        displayName: parsed.data.displayName?.trim() ?? null,
        now: clock(),
      });
      if (!user) {
        return sendError(
          reply,
          409,
          'EMAIL_ALREADY_REGISTERED',
          'Аккаунт с таким email уже существует',
        );
      }
      return reply.code(201).send({
        ...(await createSession(user)),
        recoveryCode,
      });
    },
  );

  app.post(
    '/v1/auth/login',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const parsed = loginSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendError(
          reply,
          400,
          'VALIDATION_ERROR',
          'Проверьте email и пароль',
        );
      }
      const user = await store.findUserByEmail(normalizeEmail(parsed.data.email));
      const valid = await verify(
        user?.passwordHash ?? dummyPasswordHash,
        parsed.data.password,
      );
      if (!user || !valid) {
        return sendError(
          reply,
          401,
          'INVALID_CREDENTIALS',
          'Неверный email или пароль',
        );
      }
      return reply.send(await createSession(user));
    },
  );

  app.post(
    '/v1/auth/recover',
    { config: { rateLimit: { max: 5, timeWindow: '5 minutes' } } },
    async (request, reply) => {
      const parsed = recoverSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendError(
          reply,
          400,
          'VALIDATION_ERROR',
          'Проверьте email, код восстановления и новый пароль',
        );
      }
      const nextRecoveryCode = randomBytes(18).toString('base64url');
      const passwordHash = await hash(parsed.data.newPassword, passwordOptions);
      const user = await store.resetPassword({
        email: normalizeEmail(parsed.data.email),
        recoveryCodeHash: tokenHash(parsed.data.recoveryCode),
        passwordHash,
        nextRecoveryCodeHash: tokenHash(nextRecoveryCode),
        now: clock(),
      });
      if (!user) {
        return sendError(
          reply,
          401,
          'INVALID_RECOVERY_CODE',
          'Email или код восстановления не подошли',
        );
      }
      return reply.send({
        ...(await createSession(user)),
        recoveryCode: nextRecoveryCode,
      });
    },
  );

  app.post(
    '/v1/auth/refresh',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const parsed = refreshSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendError(
          reply,
          400,
          'VALIDATION_ERROR',
          'Refresh token отсутствует или поврежден',
        );
      }
      const now = clock();
      const replacementToken = randomBytes(32).toString('base64url');
      const user = await store.rotateRefreshToken(
        tokenHash(parsed.data.refreshToken),
        {
          tokenHash: tokenHash(replacementToken),
          userId: '',
          familyId: '',
          expiresAt: new Date(
            now.getTime() + config.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
          ),
          createdAt: now,
        },
        now,
      );
      if (!user) {
        return sendError(
          reply,
          401,
          'INVALID_REFRESH_TOKEN',
          'Сессия истекла. Войдите снова',
        );
      }
      return reply.send({
        user: toPublicUser(user),
        accessToken: app.jwt.sign(
          { sub: user.id },
          { expiresIn: config.accessTokenTtl },
        ),
        refreshToken: replacementToken,
        expiresIn: accessTokenSeconds(config.accessTokenTtl),
      });
    },
  );

  app.post(
    '/v1/auth/logout',
    { preHandler: requireUser },
    async (request, reply) => {
      const parsed = refreshSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(204).send();
      await store.revokeRefreshToken(tokenHash(parsed.data.refreshToken));
      return reply.code(204).send();
    },
  );

  app.get('/v1/me', { preHandler: requireUser }, async (request, reply) => {
    const user = await store.findUserById(currentUserId(request));
    if (!user) return sendError(reply, 401, 'UNAUTHORIZED', 'Аккаунт недоступен');
    return reply.send(toPublicUser(user));
  });

  app.post(
    '/v1/sync/events',
    { preHandler: requireUser },
    async (request, reply) => {
      const parsed = pushEventsSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendError(
          reply,
          400,
          'VALIDATION_ERROR',
          'Проверьте пакет синхронизации',
          parsed.error.flatten(),
        );
      }
      const result = await store.pushEvents(
        currentUserId(request),
        parsed.data.deviceId,
        parsed.data.events.map((event) => ({
          eventId: event.id,
          eventType: event.type,
          aggregateId: event.aggregateId,
          occurredAt: new Date(event.occurredAt),
          payload: event.payload as JsonObject,
        })),
      );
      return reply.send(result);
    },
  );

  app.get(
    '/v1/sync/events',
    { preHandler: requireUser },
    async (request, reply) => {
      const parsed = pullEventsSchema.safeParse(request.query);
      if (!parsed.success) {
        return sendError(
          reply,
          400,
          'VALIDATION_ERROR',
          'Проверьте параметры синхронизации',
          parsed.error.flatten(),
        );
      }
      const result = await store.pullEvents(
        currentUserId(request),
        parsed.data.after,
        parsed.data.limit,
      );
      return reply.send({
        events: result.events.map((event) => ({
          id: event.eventId,
          type: event.eventType,
          aggregateId: event.aggregateId,
          occurredAt: event.occurredAt.toISOString(),
          payload: event.payload,
          deviceId: event.deviceId,
          serverSequence: event.serverSequence,
        })),
        cursor: result.cursor,
        hasMore: result.hasMore,
      });
    },
  );

  app.delete(
    '/v1/account',
    { preHandler: requireUser },
    async (request, reply) => {
      await store.deleteUser(currentUserId(request), clock());
      return reply.code(204).send();
    },
  );

  app.addHook('onClose', async () => store.close());
  return app;
}

export type PoraApp = FastifyInstance;
