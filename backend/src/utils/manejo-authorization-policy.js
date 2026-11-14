export const MANEJO_AUTHORIZER_ROLES = ['ADMINISTRADOR', 'ADMIN', 'GERENTE', 'GERENTE_GENERAL'];
export function canAuthorizeManejo(role) {
  return MANEJO_AUTHORIZER_ROLES.includes(role);
}
