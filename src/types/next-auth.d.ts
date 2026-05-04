import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: string;
      company_id: number;
      user_id: string;
    };
  }

  interface User {
    role: string;
    company_id: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: string;
    company_id: number;
    user_id: string;
  }
}
