export const gradeListRouteSchema = {
  querystring: { type: 'object', additionalProperties: false, properties: {
    assignment_id: { type: 'string', maxLength: 128 }, category: { type: 'string', maxLength: 40 }, kelas: { type: 'string', maxLength: 80 },
    search: { type: 'string', maxLength: 100 }, student_id: { type: 'string', maxLength: 128 }, page: { type: 'string', pattern: '^[0-9]+$' }, pageSize: { type: 'string', pattern: '^[0-9]+$' },
  } },
} as const;

export const assignmentListRouteSchema = {
  querystring: { type: 'object', additionalProperties: false, properties: {
    category: { type: 'string', maxLength: 40 }, kelas: { type: 'string', maxLength: 80 }, search: { type: 'string', maxLength: 100 }, page: { type: 'string', pattern: '^[0-9]+$' }, pageSize: { type: 'string', pattern: '^[0-9]+$' },
  } },
} as const;

export const assignmentCreateRouteSchema = {
  body: { type: 'object', additionalProperties: false, required: ['title', 'category'], properties: {
    title: { type: 'string', minLength: 1, maxLength: 200 }, category: { type: 'string', maxLength: 40 }, description: { type: 'string', maxLength: 1000 },
    keterangan_kategori: { type: 'string', maxLength: 1000 }, kelas: { type: 'string', maxLength: 80 }, date: { type: 'string', minLength: 10, maxLength: 10 }, due_date: { type: 'string', minLength: 10, maxLength: 10 }, change_reason: { type: 'string', maxLength: 500 },
  } },
} as const;

export const bulkGradeRouteSchema = {
  body: { type: 'object', additionalProperties: false, required: ['assignment_id', 'grades'], properties: {
    assignment_id: { type: 'string', minLength: 1, maxLength: 128 }, change_reason: { type: 'string', maxLength: 500 },
    grades: { type: 'array', minItems: 1, maxItems: 500, items: { type: 'object', additionalProperties: false, required: ['student_id', 'nilai'], properties: { student_id: { type: 'string', minLength: 1, maxLength: 128 }, nilai: { type: 'string', enum: ['A', 'B', 'C', 'D', 'E'] }, keterangan: { type: 'string', maxLength: 500 } } } },
  } },
} as const;

export const gradeDistributionRouteSchema = {
  querystring: { type: 'object', additionalProperties: false, properties: { category: { type: 'string', maxLength: 40 }, kelas: { type: 'string', maxLength: 80 }, periode: { type: 'string', maxLength: 40 } } },
} as const;
