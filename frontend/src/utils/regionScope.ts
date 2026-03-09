export function stripRegionScopePrefix(scope: string | null | undefined): string {
  if (!scope) return '';
  return scope.startsWith('#') ? scope.slice(1) : scope;
}
