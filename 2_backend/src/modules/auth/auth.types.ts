export interface AccessUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  expiresAt: number;
  tokenType: 'bearer';
}

export interface Member extends AccessUser {
  isActive: boolean;
  roleIsActive: boolean;
  emailConfirmed: boolean;
  invitedBy: string | null;
}

export interface AuthIdentity {
  id: string;
  sessionId: string;
}
