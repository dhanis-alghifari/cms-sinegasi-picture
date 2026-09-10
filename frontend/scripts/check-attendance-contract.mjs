import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(scriptDirectory, 'fixtures', 'attendance-list-response.json');
const frontendRoot = path.resolve(scriptDirectory, '..');
process.env.TSX_TSCONFIG_PATH = path.join(frontendRoot, 'tsconfig.app.json');

const { decodeAttendanceList } = await import(
  pathToFileURL(path.join(frontendRoot, 'src/features/attendance/api/attendance.responses.ts')).href,
);

const payload = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const response = decodeAttendanceList(payload);
const [record] = response.data;

assert.equal(record.student_nis, '001');
assert.equal(record.student_nama, 'Siti Aminah');
assert.equal(record.kelas, 'X TKJ');
assert.equal('students' in record, false);

console.log('Attendance contract passed: nested student identity is normalized into the frontend record shape.');
