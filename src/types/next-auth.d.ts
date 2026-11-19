import "next-auth";
import "next-auth/jwt";
import type { RoleName } from "@/lib/permissions";

type Kind = "staff" | "student";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      email?: string | null;
      role: RoleName;
      kind: Kind;
      mfaSetupRequired?: boolean;
    };
  }

  interface User {
    id: string;
    role: RoleName;
    kind: Kind;
    mfaSetupRequired?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: RoleName;
    kind?: Kind;
    mfaSetupRequired?: boolean;
    expiresAt?: number;
  }
}
