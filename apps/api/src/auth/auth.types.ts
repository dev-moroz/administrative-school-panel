import type { Request } from 'express';

export type AuthUser = {
  id: string;
  email: string;
  role: string;
  permissions: ReadonlySet<string>;
};

export type AuthenticatedRequest = Request & { user: AuthUser };
