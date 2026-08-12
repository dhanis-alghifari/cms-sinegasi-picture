export const loginRouteSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['username', 'password'],
    properties: {
      username: { type: 'string', minLength: 1, maxLength: 64 },
      password: { type: 'string', minLength: 1, maxLength: 128 },
    },
  },
} as const;

export const changePasswordRouteSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    anyOf: [
      {
        required: ['current_password', 'new_password', 'confirm_password'],
      },
      {
        required: ['currentPassword', 'newPassword', 'confirmPassword'],
      },
    ],
    properties: {
      current_password: { type: 'string', minLength: 1, maxLength: 128 },
      new_password: { type: 'string', minLength: 1, maxLength: 128 },
      confirm_password: { type: 'string', minLength: 1, maxLength: 128 },
      currentPassword: { type: 'string', minLength: 1, maxLength: 128 },
      newPassword: { type: 'string', minLength: 1, maxLength: 128 },
      confirmPassword: { type: 'string', minLength: 1, maxLength: 128 },
    },
  },
} as const;
