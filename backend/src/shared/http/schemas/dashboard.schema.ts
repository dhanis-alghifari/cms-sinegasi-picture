export const studentDashboardSummaryRouteSchema = {
  params: {
    type: 'object',
    additionalProperties: false,
    required: ['id'],
    properties: {
      id: { type: 'string', minLength: 1, maxLength: 128 },
    },
  },
} as const;

export const dashboardSummaryRouteSchema = {
  response: {
    200: {
      type: 'object',
      required: ['success', 'scope', 'role', 'kas', 'absensi', 'alat'],
      properties: {
        success: { const: true },
        scope: { type: 'string', enum: ['operational', 'personal'] },
        role: { type: 'string' },
        reportDate: { type: 'string' },
        timezone: { type: 'string' },
        studentId: { type: 'string' },
        profile: { type: 'object', additionalProperties: true },
        kas: {
          type: 'object',
          required: ['saldoTerakhir', 'pemasukanBulanIni', 'pengeluaranBulanIni', 'transaksiTerbaru'],
          properties: {
            saldoTerakhir: { type: 'number' },
            pemasukanBulanIni: { type: 'number' },
            pengeluaranBulanIni: { type: 'number' },
            transaksiTerbaru: { type: 'array', items: { type: 'object', additionalProperties: true } },
          },
          additionalProperties: false,
        },
        absensi: {
          type: 'object',
          required: ['hadir', 'sakit', 'izin', 'alpha', 'totalSiswa', 'totalTercatat', 'persentaseHadir'],
          properties: {
            hadir: { type: 'number' },
            sakit: { type: 'number' },
            izin: { type: 'number' },
            alpha: { type: 'number' },
            totalSiswa: { type: 'number' },
            totalTercatat: { type: 'number' },
            persentaseHadir: { type: 'number' },
          },
          additionalProperties: false,
        },
        alat: {
          type: 'object',
          required: ['tersedia', 'dipinjam', 'maintenance', 'rusak', 'totalAlat', 'overdueCount'],
          properties: {
            tersedia: { type: 'number' },
            dipinjam: { type: 'number' },
            maintenance: { type: 'number' },
            rusak: { type: 'number' },
            totalAlat: { type: 'number' },
            overdueCount: { type: 'number' },
          },
          additionalProperties: false,
        },
        gradeDistribution: {
          type: 'object',
          required: ['totalSiswaEvaluated', 'distribution'],
          properties: {
            totalSiswaEvaluated: { type: 'number' },
            distribution: {
              type: 'object',
              required: ['A', 'B', 'C', 'D', 'E'],
              properties: {
                A: { type: 'number' }, B: { type: 'number' }, C: { type: 'number' },
                D: { type: 'number' }, E: { type: 'number' },
              },
              additionalProperties: false,
            },
          },
          additionalProperties: false,
        },
        studentPersonal: { type: 'object', additionalProperties: true },
      },
      additionalProperties: false,
    },
    401: { type: 'object', additionalProperties: true },
    403: { type: 'object', additionalProperties: true },
    422: { type: 'object', additionalProperties: true },
    503: { type: 'object', additionalProperties: true },
  },
} as const;
