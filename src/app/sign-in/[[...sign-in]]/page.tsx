import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <main className="flex h-screen w-full items-center justify-center">
      {/* Middleware exposes only /sign-in; hash routing keeps auth steps there. */}
      <SignIn routing="hash" />
    </main>
  );
}
