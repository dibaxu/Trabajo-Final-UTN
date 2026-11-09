// Endpoints que ya existen en el backend (ver 4_docs/api.md).
import { authRequest } from '../../../lib/http.js'

export default {
  users: {
    list: () => authRequest('/users'),
    invite: ({ email, displayName }) => authRequest('/users/invitations', { method: 'POST', body: { email, displayName } }),
    setStatus: (id, isActive) => authRequest(`/users/${id}/status`, { method: 'PATCH', body: { isActive } }),
  },
}
