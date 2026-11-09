export class ApiError extends Error {
  /** status 0 = sin conexión / error de red. */
  constructor(status, message, details = []) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}
