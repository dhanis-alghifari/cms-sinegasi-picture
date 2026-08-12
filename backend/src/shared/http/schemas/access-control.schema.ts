import { USER_ROLE_VALUES } from '../../auth/auth.types.js';
import { CAPABILITY_VALUES } from '../../../middleware/capabilities.js';

export const accessControlMatrixRouteSchema = {
  response: {
    200: { type: 'object', additionalProperties: true },
    401: { type: 'object', additionalProperties: true },
    403: { type: 'object', additionalProperties: true },
    503: { type: 'object', additionalProperties: true },
  },
} as const;

export const accessControlAuditRouteSchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: { limit: { type: 'string', pattern: '^[0-9]+$' } },
  },
  response: {
    200: {
      type: 'object',
      required: ['success', 'data'],
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'array',
          maxItems: 100,
          items: {
            type: 'object',
            required: ['id', 'role_key', 'previous_capabilities', 'next_capabilities', 'change_reason', 'created_at'],
            properties: {
              id: { type: 'string', format: 'uuid' },
              actor_user_id: { type: ['string', 'null'], format: 'uuid' },
              role_key: { type: 'string', enum: [...USER_ROLE_VALUES] },
              previous_capabilities: { type: 'array', items: { type: 'string', enum: [...CAPABILITY_VALUES] } },
              next_capabilities: { type: 'array', items: { type: 'string', enum: [...CAPABILITY_VALUES] } },
              change_reason: { type: 'string' },
              created_at: { type: 'string', format: 'date-time' },
              actor: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  nama: { type: 'string' },
                  username: { type: 'string' },
                  role: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

export const accessControlUpdateRouteSchema = {
  params: {
    type: 'object',
    additionalProperties: false,
    required: ['role'],
    properties: { role: { type: 'string', enum: [...USER_ROLE_VALUES] } },
  },
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['capabilities', 'change_reason'],
    properties: {
      capabilities: { type: 'array', uniqueItems: true, items: { type: 'string', enum: [...CAPABILITY_VALUES] } },
      change_reason: { type: 'string', minLength: 5, maxLength: 500 },
    },
  },
} as const;
