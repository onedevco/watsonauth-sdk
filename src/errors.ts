export class AuthError extends Error {
  code: string;
  details?: object;

  constructor(code: string, message: string, details?: object) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, AuthError.prototype);
  }

  static fromResponse(data: { code?: string; message?: string; details?: object }): AuthError {
    return new AuthError(
      data.code || 'unknown_error',
      data.message || 'An unknown error occurred',
      data.details
    );
  }
}
