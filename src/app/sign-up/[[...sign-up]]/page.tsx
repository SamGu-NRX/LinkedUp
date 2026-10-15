import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <main className="flex h-screen w-full items-center justify-center">
      {/* Middleware exposes only /sign-up; hash routing keeps verification there. */}
      <SignUp routing="hash" />
    </main>
  );
}
