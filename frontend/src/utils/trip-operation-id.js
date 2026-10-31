export function resolveOperationTripId(value, resolveLocal) {
  const id = Number(value);
  const candidate = id < 0 ? Number(resolveLocal(id)) : id;
  return Number.isSafeInteger(candidate) && candidate > 0 && candidate <= 2147483647 ? candidate : null;
}
