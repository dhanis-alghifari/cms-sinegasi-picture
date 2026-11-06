import type { CreateStudentPayload, LinkExistingStudentAccountPayload, UpdateStudentPayload } from '../types/students.types';

const specializationValues: Readonly<Record<string, string>> = {
  kamera: 'camera', editing: 'editing', naskah: 'screenwriting',
};

export function toStudentRequest(payload: CreateStudentPayload | UpdateStudentPayload | LinkExistingStudentAccountPayload) {
  const {
    nis: student_number,
    nama: name,
    kelas: class_name,
    peminatan: specialization,
    no_telepon: phone_number,
    foto_url: photo_url,
    ...rest
  } = payload;
  return {
    ...rest,
    ...(student_number !== undefined ? { student_number } : {}),
    ...(name !== undefined ? { name } : {}),
    ...(class_name !== undefined ? { class_name } : {}),
    ...(specialization !== undefined ? { specialization: specializationValues[specialization] } : {}),
    ...(phone_number !== undefined ? { phone_number } : {}),
    ...(photo_url !== undefined ? { photo_url } : {}),
  };
}
