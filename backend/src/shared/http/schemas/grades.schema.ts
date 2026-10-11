export const gradeListRouteSchema = {
  querystring: { type: 'object', additionalProperties: false, properties: {
    assignment_id: { type: 'string', maxLength: 128 }, category: { type: 'string', maxLength: 40 }, class_name: { type: 'string', maxLength: 80 },
    search: { type: 'string', maxLength: 100 }, student_id: { type: 'string', maxLength: 128 }, scope: { type: 'string', enum: ['own', 'operational'] }, page: { type: 'string', pattern: '^[0-9]+$' }, pageSize: { type: 'string', pattern: '^[0-9]+$' },
  } },
} as const;

export const assignmentListRouteSchema = {
  querystring: { type: 'object', additionalProperties: false, properties: {
    category: { type: 'string', maxLength: 40 }, class_name: { type: 'string', maxLength: 80 }, search: { type: 'string', maxLength: 100 }, scope: { type: 'string', enum: ['own', 'operational'] }, page: { type: 'string', pattern: '^[0-9]+$' }, pageSize: { type: 'string', pattern: '^[0-9]+$' },
  } },
} as const;

export const assignmentCreateRouteSchema = {
  body: { type: 'object', additionalProperties: false, required: ['title', 'category'], properties: {
    title: { type: 'string', minLength: 1, maxLength: 200 }, category: { type: 'string', maxLength: 40 }, description: { type: 'string', maxLength: 1000 },
    category_description: { type: 'string', maxLength: 1000 }, class_name: { type: 'string', maxLength: 80 }, date: { type: 'string', minLength: 10, maxLength: 10 }, due_date: { type: 'string', minLength: 10, maxLength: 10 }, change_reason: { type: 'string', maxLength: 500 },
  } },
} as const;

export const bulkGradeRouteSchema = {
  body: { type: 'object', additionalProperties: false, required: ['assignment_id', 'grades'], properties: {
    assignment_id: { type: 'string', minLength: 1, maxLength: 128 }, change_reason: { type: 'string', maxLength: 500 },
    grades: { type: 'array', minItems: 1, maxItems: 500, items: { type: 'object', additionalProperties: false, required: ['student_id', 'grade'], properties: { student_id: { type: 'string', minLength: 1, maxLength: 128 }, grade: { type: 'string', enum: ['A', 'B', 'C', 'D', 'E'] }, notes: { type: 'string', maxLength: 500 } } } },
  } },
} as const;

export const gradeDistributionRouteSchema = {
  querystring: { type: 'object', additionalProperties: false, properties: { category: { type: 'string', maxLength: 40 }, class_name: { type: 'string', maxLength: 80 }, term: { type: 'string', maxLength: 40 } } },
} as const;

export const reportPeriodListRouteSchema = {
  querystring: { type: 'object', additionalProperties: false, properties: {} },
} as const;

export const reportPeriodCreateRouteSchema = {
  body: { type: 'object', additionalProperties: false, required: ['academic_year', 'semester', 'start_date', 'end_date'], properties: {
    academic_year: { type: 'string', pattern: '^[0-9]{4}/[0-9]{4}$' }, semester: { type: 'string', enum: ['ganjil', 'genap'] },
    start_date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' }, end_date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
  } },
} as const;

export const reportListRouteSchema = {
  querystring: { type: 'object', additionalProperties: false, properties: { period_id: { type: 'string', maxLength: 128 }, student_id: { type: 'string', maxLength: 128 }, class_name: { type: 'string', maxLength: 80 }, scope: { type: 'string', enum: ['own', 'operational'] } } },
} as const;

export const reportActionRouteSchema = {
  body: { type: 'object', additionalProperties: false, required: ['period_id'], properties: { period_id: { type: 'string', minLength: 1, maxLength: 128 } } },
} as const;

export const pklListRouteSchema = {
  querystring: { type: 'object', additionalProperties: false, properties: { student_id: { type: 'string', maxLength: 128 }, class_name: { type: 'string', maxLength: 80 } } },
} as const;

export const pklCreateRouteSchema = {
  body: { type: 'object', additionalProperties: false, required: ['student_id', 'start_date', 'end_date', 'institution'], properties: {
    student_id: { type: 'string', minLength: 1, maxLength: 128 }, start_date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' }, end_date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' }, institution: { type: 'string', minLength: 2, maxLength: 200 }, notes: { type: 'string', maxLength: 1000 },
  } },
} as const;

export const pklReviewRouteSchema = {
  body: { type: 'object', additionalProperties: false, required: ['id', 'status'], properties: { id: { type: 'string', minLength: 1, maxLength: 128 }, status: { type: 'string', enum: ['approved', 'rejected', 'completed'] } } },
} as const;
