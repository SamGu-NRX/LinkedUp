// src/app/app/template.tsx
import { OnboardingGate } from "./onboarding-gate";

/**
 * The /app tree is client-component heavy (the layout uses useTheme), so
 * the DB-backed onboarding gate can't live in the layout. A template is a
 * server component wrapper that re-applies the gate on every navigation
 * into /app/**.
 */
export default function AppTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return <OnboardingGate>{children}</OnboardingGate>;
}
