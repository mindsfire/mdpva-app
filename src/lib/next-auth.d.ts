import type { Role } from "@/lib/rbac";

declare module "next-auth" {
  interface User {
    role: Role;
    tokenVersion: number;
    mustChangePassword: boolean;
  }

  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      role: Role;
      tokenVersion: number;
      mustChangePassword: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    role?: Role;
    tokenVersion?: number;
    mustChangePassword?: boolean;
    lastVersionCheck?: number;
    invalid?: boolean;
  }
}
