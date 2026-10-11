export function isModuleLoadError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('message' in error)) return false;
  if (typeof error.message !== 'string') return false;

  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS for/i.test(error.message);
}
