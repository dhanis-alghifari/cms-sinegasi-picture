type FieldMap = Readonly<Record<string, string>>;

export function mapRequestFields(
  input: Record<string, unknown>,
  fieldMap: FieldMap,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).map(([field, value]) => [fieldMap[field] ?? field, value]),
  );
}

export function mapRequestRecords(
  value: unknown,
  fieldMap: FieldMap,
): unknown {
  if (!Array.isArray(value)) return value;
  return value.map((item) => (
    item && typeof item === 'object'
      ? mapRequestFields(item as Record<string, unknown>, fieldMap)
      : item
  ));
}
