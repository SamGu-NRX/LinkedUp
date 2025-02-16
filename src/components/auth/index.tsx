"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoginFormValues, RegisterFormValues } from "@/schema/auth";
import { loginAction, registerAction, signInWithOAuth } from "@/actions/auth";
import { useToast } from "@/lib/hooks/use-toast";
import LoginSection from "./LoginForm";
import RegisterSection from "./RegisterForm";

interface AuthProps {
  mode: "login" | "register";
  className?: string;
  redirectTo?: string;
}

export function Auth({ mode, className, redirectTo = "/" }: AuthProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const handleLogin = async (data: LoginFormValues) => {
    setLoading(true);
    try {
      const result = await loginAction(data);

      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "You have been logged in successfully!",
      });

      router.push(redirectTo);
      router.refresh();
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (data: RegisterFormValues) => {
    setLoading(true);
    try {
      const result = await registerAction(data);

      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Your account has been created!",
      });

      router.push(redirectTo);
      router.refresh();
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: string) => {
    try {
      const result = await signInWithOAuth(provider);

      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        });
        return;
      }

      // Redirect to provider's auth page
      if (result.url) {
        window.location.href = result.url;
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to initialize OAuth login",
        variant: "destructive",
      });
    }
  };

  return mode === "login" ? (
    <LoginSection
      loading={loading}
      onSubmit={handleLogin}
      onOAuthClick={handleOAuth}
      className={className}
    />
  ) : (
    <RegisterSection
      loading={loading}
      onSubmit={handleRegister}
      onOAuthClick={handleOAuth}
      className={className}
    />
  );
}
