import { OPERATIONAL_USER_ROLE_VALUES, USER_ROLE_VALUES } from '../../auth/auth.types.js';

const userIdParams = {
  type: 'object',
  additionalProperties: false,
  required: ['id'],
  properties: { id: { type: 'string', minLength: 1, maxLength: 128 } },
} as const;

const roles = USER_ROLE_VALUES;

export const usersListRouteSchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      search: { type: 'string', maxLength: 100 },
      role: { type: 'string', enum: ['all', ...roles] },
      is_active: { type: 'string', enum: ['all', 'true', 'false'] },
      page: { type: 'string', pattern: '^[0-9]+$' },
      pageSize: { type: 'string', pattern: '^[0-9]+$' },
    },
  },
} as const;

export const userIdRouteSchema = { params: userIdParams } as const;

export const userCreateRouteSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['username', 'name', 'role', 'password'],
    properties: {
      username: { type: 'string', minLength: 3, maxLength: 30, pattern: '^[a-zA-Z0-9._-]+$' },
      name: { type: 'string', minLength: 2, maxLength: 200 },
      role: { type: 'string', enum: OPERATIONAL_USER_ROLE_VALUES },
      password: { type: 'string', minLength: 1, maxLength: 128 },
      change_reason: { type: 'string', maxLength: 500 },
    },
  },
} as const;

export const userUpdateRouteSchema = {
  params: userIdParams,
  body: {
    type: 'object',
    additionalProperties: false,
    minProperties: 1,
    properties: {
      username: { type: 'string', minLength: 3, maxLength: 30, pattern: '^[a-zA-Z0-9._-]+$' },
      name: { type: 'string', minLength: 2, maxLength: 200 },
      role: { type: 'string', enum: roles },
      is_active: { type: 'boolean' },
      change_reason: { type: 'string', minLength: 5, maxLength: 500 },
    },
  },
} as const;

export const userResetPasswordRouteSchema = {
  params: userIdParams,
  headers: {
    type: 'object',
    required: ['x-idempotency-key'],
    properties: {
      'x-idempotency-key': { type: 'string', minLength: 8, maxLength: 128 },
    },
  },
  body: {
    type: 'object',
    additionalProperties: false,
    properties: {
      changeReason: { type: 'string', minLength: 5, maxLength: 500 },
      change_reason: { type: 'string', minLength: 5, maxLength: 500 },
    },
  },
} as const;
