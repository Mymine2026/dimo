import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

// Every page requires a session except the login page; API routes check the session themselves.
export const config = {
  matcher: ["/((?!api|login|_next|favicon.ico|.*\\.png$|.*\\.svg$|.*\\.jpg$|.*\\.ico$).*)"],
};
