"use client";

import React from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, LoginFormValues } from "@/schema/auth";
import { cn } from "@/lib/shadcn";
import { motion, AnimatePresence } from "framer-motion";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import OAuthSection from "./OAuth";
import { AmbientBackground, LabelInputContainer } from "./utils";
import SubmitButton from "./SubmitButton";
import Link from "next/link";

interface LoginFormProps {
  className?: string;
  loading?: boolean;
  onSubmit: (data: LoginFormValues) => void;
  handleOAuth: (providerName: string) => void;
}

function LoginForm({
  className,
  loading = false,
  onSubmit,
  handleOAuth,
}: LoginFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onLoginFormSubmit: SubmitHandler<LoginFormValues> = (data) => {
    onSubmit(data);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeInOut" }}
      className={cn("w-full max-w-md", className)}
    >
      <Card className="w-full max-w-lg overflow-hidden rounded-2xl border border-gray-200 bg-white/80 p-6 shadow-xl backdrop-blur-sm dark:border-gray-800 dark:bg-black/80">
        <CardHeader className="left-0 text-2xl font-bold text-gray-900 dark:text-white">
          <CardTitle>Welcome back</CardTitle>
          <CardDescription className="mt-2 text-gray-600 dark:text-gray-400">
            Sign in to your account
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onLoginFormSubmit)} className="mt-2">
          <CardContent className="space-y-4">
            <AnimatePresence mode="wait">
              <motion.div
                key="register-fields"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
                className="space-y-6"
              >
                {/* Email */}
                <LabelInputContainer>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    {...register("email")}
                    className={cn(
                      "bg-white/40 backdrop-blur-sm placeholder:text-muted-foreground/50 dark:bg-black/40",
                      errors.email &&
                        "border-red-500 focus-visible:ring-red-500",
                    )}
                  />
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.email.message}
                    </p>
                  )}
                </LabelInputContainer>

                {/* Password */}
                <LabelInputContainer>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    // Connect this input to RHF
                    {...register("password")}
                    className={cn(
                      "bg-white/40 backdrop-blur-sm placeholder:text-muted-foreground/50 dark:bg-black/40",
                      errors.password &&
                        "border-red-500 focus-visible:ring-red-500",
                    )}
                  />
                  {errors.password && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.password.message}
                    </p>
                  )}
                </LabelInputContainer>
              </motion.div>
            </AnimatePresence>
          </CardContent>

          <CardFooter className="flex flex-col space-y-4 md:mt-3">
            <SubmitButton loading={loading} mode="login" />
            <OAuthSection handleOAuthClick={handleOAuth} />
            <p className="text-center text-sm text-muted-foreground">
              Don't have an account yet?{" "}
              <Link href="/register" className="text-primary hover:underline">
                Register
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </motion.div>
  );
}

export interface LoginSectionProps {
  className?: string;
  containerClassName?: string;
  loading?: boolean;
  onSubmit: (data: LoginFormValues) => void;
  onOAuthClick: (providerName: string) => void;
}

const LoginSection: React.FC<LoginSectionProps> = ({
  className,
  containerClassName,
  loading,
  onSubmit,
  onOAuthClick,
}) => {
  return (
    <section
      className={cn(
        "relative mt-4 flex w-full flex-col items-center justify-center bg-[radial-gradient(circle_at_1px_1px,rgb(220,220,220)_1px,transparent_0)] bg-[size:40px_40px] p-4 dark:bg-[radial-gradient(circle_at_1px_1px,rgb(40,40,40)_1px,transparent_0)]",
        containerClassName,
      )}
      style={{ minHeight: "calc(100vh - 56.5px - 16px)" }} // Adjust based on nav height + margin top 1 rem
    >
      <AmbientBackground />
      <LoginForm
        className={className}
        loading={loading}
        onSubmit={onSubmit}
        handleOAuth={onOAuthClick}
      />
    </section>
  );
};

export default LoginSection;
