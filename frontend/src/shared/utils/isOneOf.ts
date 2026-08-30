/**
 * Narrows an unknown string value to one of the values declared by a
 * readonly option list. Use this at UI boundaries such as Select callbacks.
 */
export function isOneOf<const Values extends readonly string[]>(
  value: unknown,
  values: Values,
): value is Values[number] {
  return typeof value === 'string' && values.some((option) => option === value);
}
