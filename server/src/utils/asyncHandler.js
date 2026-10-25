/**
 * Express 5 meneruskan rejection dari handler async secara otomatis.
 * Wrapper ini tetap dipakai agar perilakunya eksplisit dan konsisten.
 */
export function asyncHandler(handler) {
  return function wrappedHandler(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
