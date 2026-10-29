import type { Request } from 'express';

export type AuthUser = {
  id: string;
  email: string;
  role: string;
  teacherId: string | null;
  permissions: ReadonlySet<string>;
};

export type AuthenticatedRequest = Request & { user: AuthUser };
