import { z } from 'zod';
import { CAPABILITY_VALUES } from '@/shared/auth/capabilities';
import { USER_ROLE_VALUES } from '@/shared/types/common';
import { decodeWithSchema } from '@/shared/api/responseValidation';
import type { AuthUser, ChangePasswordResponse, LoginResponse } from '../types/auth.types';

const authUserSchema: z.ZodType<AuthUser> = z.object({
  id: z.string().min(1),
  username: z.string().min(1),
  nama: z.string().min(1),
  role: z.enum(USER_ROLE_VALUES),
  is_first_login: z.boolean(),
  is_active: z.boolean(),
  studentId: z.string().min(1).optional(),
  auth_version: z.number().int().nonnegative().optional(),
  capabilities: z.array(z.enum(CAPABILITY_VALUES)).optional(),
}).loose();

const loginResponseSchema = z.object({
  success: z.literal(true),
  token: z.string().min(1),
  user: authUserSchema,
}).transform(({ token, user }): LoginResponse => ({ token, user }));

const sessionResponseSchema = authUserSchema;

const changePasswordResponseSchema = z.object({
  success: z.literal(true),
  token: z.string().min(1),
  user: authUserSchema,
  message: z.string().min(1),
}).transform(({ token, user, message }): ChangePasswordResponse => ({ token, user, message, success: true }));

const logoutResponseSchema = z.object({
  success: z.literal(true),
  message: z.string().min(1),
}).transform(() => undefined);

export const decodeLoginResponse = decodeWithSchema(loginResponseSchema);
export const decodeSessionResponse = decodeWithSchema(sessionResponseSchema);
export const decodeChangePasswordResponse = decodeWithSchema(changePasswordResponseSchema);
export const decodeLogoutResponse = decodeWithSchema(logoutResponseSchema);
