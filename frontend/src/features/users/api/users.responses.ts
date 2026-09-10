import { z } from 'zod';
import { USER_ROLE_VALUES } from '@/shared/types/common';
import { decodeDataEnvelope, decodePaginatedResponse, decodeWithSchema } from '@/shared/api/responseValidation';
import { actorSummarySchema, optionalTextSchema } from '@/shared/api/responseSchemas';
import type { CreateUserResponse, ResetPasswordResponse, UserAccount, UserResponse } from '../types/users.types';

const userSchema: z.ZodType<UserAccount> = z.object({
  id: z.string().min(1),
  username: z.string().min(1),
  nama: z.string().min(1),
  role: z.enum(USER_ROLE_VALUES),
  is_first_login: z.boolean(),
  is_active: z.boolean(),
  created_at: z.string().min(1),
  updated_at: optionalTextSchema,
  created_by: optionalTextSchema,
  updated_by: optionalTextSchema,
  created_actor: actorSummarySchema.optional(),
  updated_actor: actorSummarySchema.optional(),
}).loose();

const userResponseSchema: z.ZodType<UserResponse> = z.object({
  success: z.literal(true),
  data: userSchema,
}).loose();

const createUserResponseSchema: z.ZodType<CreateUserResponse> = z.object({
  success: z.literal(true),
  data: userSchema,
  temporary_password: z.string().min(1),
}).loose();

const deleteUserResponseSchema = z.object({
  success: z.literal(true),
  message: z.string().min(1),
}).loose();

const resetPasswordResponseSchema: z.ZodType<ResetPasswordResponse> = z.object({
  success: z.literal(true).optional(),
  message: z.string().min(1),
  temporary_password: z.string().min(1),
}).loose().transform(({ message, temporary_password }) => ({ message, temporary_password }));

export const decodeUserList = decodePaginatedResponse(userSchema);
export const decodeUserResponse = decodeWithSchema(userResponseSchema);
export const decodeCreateUserResponse = decodeWithSchema(createUserResponseSchema);
export const decodeDeleteUserResponse = decodeWithSchema(deleteUserResponseSchema);
export const decodeResetPasswordResponse = decodeWithSchema(resetPasswordResponseSchema);
export const decodeUser = decodeDataEnvelope(userSchema);
