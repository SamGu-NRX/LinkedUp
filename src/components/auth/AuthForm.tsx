// "use client";

// import React, { useState } from "react";
// import { motion, AnimatePresence } from "framer-motion";
// import { Label } from "@/components/ui/label";
// import { Input } from "@/components/ui/input";
// import { Button } from "@/components/ui/button";
// import { cn } from "@/lib/shadcn";
// import Link from "next/link";
// import {
//   Card,
//   CardContent,
//   CardDescription,
//   CardFooter,
//   CardHeader,
//   CardTitle,
// } from "@/components/ui/card";
// import OAuthSection from "./OAuth";
// import {
//   AmbientBackground,
//   BottomGradient,
//   LabelInputContainer,
// } from "./utils";
// import { LoginFormValues, RegisterFormValues, FormFields, FormErrors } from "./auth-types";

// interface AuthFormProps {
//   // This is the server action you get from `page.tsx`
//   handleAuthAction: (formData: FormData) => Promise<any>;
//   className?: string;
//   mode?: "register" | "login";
//   loading?: boolean;
// }

// // Define separate types for login and register forms

// export const AuthForm: React.FC<AuthFormProps> = ({
//   handleAuthAction,
//   className,
//   mode = "login",
//   loading = false,
// }) => {
//   // Local state for form fields
//   const [formValues, setFormValues] = useState<
//     LoginFormValues | RegisterFormValues
//   >(
//     mode === "login"
//       ? {
//           email: "",
//           password: "",
//         }
//       : {
//           firstName: "",
//           lastName: "",
//           email: "",
//           password: "",
//           confirmPassword: "",
//         },
//   );

//   const [errors, setErrors] = useState<FormErrors>({});

//   // Whenever an input changes, update local state
//   function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
//     const { id, value } = e.target;
//     setFormValues((prev) => ({ ...prev, [id]: value }));
//   }

//   async function handleSubmit(e: React.FormEvent) {
//     e.preventDefault();
//     if (mode === "register" && onRegisterSubmit) {
//       onRegisterSubmit(formValues);
//     } else {
//       // If you also want login logic here, handle it
//       // e.g., onLoginSubmit?.(formValues)
//     }
//   }

//   const handleOAuthClick = async (providerName: string) => {
//     try {
//       // The actual redirect is handled by the provider + Supabase
//       const { data, error } = await supabase.auth.signInWithOAuth({
//         provider: providerName,
//         options: {
//           // On successful sign in, Supabase will redirect
//           // the user to the URL below. Adjust as needed.
//           redirectTo: `${window.location.origin}/`,
//         },
//       });
//       if (error) {
//         console.error("Error with OAuth:", error.message);
//       } else {
//         // Optionally, you can console.log or do something with `data.url`
//         console.log("Redirecting to:", data.url);
//       }
//     } catch (err) {
//       console.error("OAuth error:", err);
//     }
//   };

//   return (
//     <div
//       className={cn(
//         "relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_1px_1px,rgb(220,220,220)_1px,transparent_0)] bg-[size:40px_40px] p-4 dark:bg-[radial-gradient(circle_at_1px_1px,rgb(40,40,40)_1px,transparent_0)]",
//         className,
//       )}
//     >
//       <AmbientBackground />
//       <AuthFormCard
//         formValues={formValues}
//         onChange={handleChange}
//         mode={mode}
//         loading={loading}
//         onSubmit={handleSubmit}
//         handleOAuthClick={}
//       />
//     </div>
//   );
// };

// interface AuthFormCardProps {
//   mode: "register" | "login";
//   loading: boolean;
//   formValues: {
//     firstName: string;
//     lastName: string;
//     email: string;
//     password: string;
//     confirmPassword: string;
//   };
//   onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
//   onSubmit: (e: React.FormEvent) => void;
//   handleOAuthClick: (providerName: string) => void;
// }

// const AuthFormCard: React.FC<AuthFormCardProps> = ({
//   mode,
//   loading,
//   formValues,
//   onChange,
//   onSubmit,
//   handleOAuthClick,
// }) => (
//   <motion.div
//     initial={{ opacity: 0, y: 20 }}
//     animate={{ opacity: 1, y: 0 }}
//     transition={{ duration: 0.5, ease: "easeInOut" }}
//     className="relative w-full max-w-md"
//   >
//     <Card className="w-full max-w-lg overflow-hidden rounded-2xl border border-gray-200 bg-white/80 p-6 shadow-xl backdrop-blur-sm dark:border-gray-800 dark:bg-black/80">
//       <CardHeader className="left-0 text-2xl font-bold text-gray-900 dark:text-white">
//         <CardTitle>
//           {mode === "register" ? "Create account" : "Welcome back"}{" "}
//           {/* TODO: add name if welcome back */}
//         </CardTitle>

//         <CardDescription className="mt-2 text-gray-600 dark:text-gray-400">
//           {mode === "register"
//             ? "Create an account to get started"
//             : "Sign in to your account"}
//         </CardDescription>
//       </CardHeader>

//       <form onSubmit={onSubmit} className="mt-2">
//         <CardContent className="space-y-4">
//           <AnimatePresence mode="wait">
//             <motion.div
//               key={mode}
//               initial={{ opacity: 0, x: mode === "register" ? 20 : -20 }}
//               animate={{ opacity: 1, x: 0 }}
//               exit={{ opacity: 0, x: mode === "register" ? -20 : 20 }}
//               transition={{ duration: 0.5, ease: "easeInOut" }}
//               className="space-y-6"
//             >
//               {mode === "register" && (
//                 <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
//                   <LabelInputContainer>
//                     <Label htmlFor="firstName">First name</Label>
//                     <Input
//                       id="firstName"
//                       placeholder="John"
//                       className="bg-white/40 backdrop-blur-sm dark:bg-black/40"
//                       value={formValues.firstName}
//                       onChange={onChange}
//                     />
//                   </LabelInputContainer>
//                   <LabelInputContainer>
//                     <Label htmlFor="lastName">Last name</Label>
//                     <Input
//                       id="lastName"
//                       placeholder="Doe"
//                       className="bg-white/40 backdrop-blur-sm dark:bg-black/40"
//                       value={formValues.lastName}
//                       onChange={onChange}
//                     />
//                   </LabelInputContainer>
//                 </div>
//               )}

//               {/* Email */}
//               <LabelInputContainer>
//                 <Label htmlFor="email">Email</Label>
//                 <Input
//                   id="email"
//                   type="email"
//                   placeholder="you@example.com"
//                   className="bg-white/40 backdrop-blur-sm dark:bg-black/40"
//                   value={formValues.email}
//                   onChange={onChange}
//                 />
//               </LabelInputContainer>

//               {/* Password */}
//               <LabelInputContainer>
//                 <Label htmlFor="password">Password</Label>
//                 <Input
//                   id="password"
//                   type="password"
//                   placeholder="••••••••"
//                   className="bg-white/40 backdrop-blur-sm dark:bg-black/40"
//                   value={formValues.password}
//                   onChange={onChange}
//                 />
//               </LabelInputContainer>

//               {/* Confirm Password (Only if registering) */}
//               {mode === "register" && (
//                 <LabelInputContainer>
//                   <Label htmlFor="confirmPassword">Confirm password</Label>
//                   <Input
//                     id="confirmPassword"
//                     type="password"
//                     placeholder="••••••••"
//                     className="bg-white/40 backdrop-blur-sm dark:bg-black/40"
//                     value={formValues.confirmPassword}
//                     onChange={onChange}
//                   />
//                 </LabelInputContainer>
//               )}
//             </motion.div>
//           </AnimatePresence>
//         </CardContent>

//         {/* You can hide or remove this if you only want register mode */}
//         {/* <ToggleModeText isLogin={!isRegister} onToggle={() => ...} /> */}

//         <CardFooter className="flex flex-col space-y-4 md:mt-3">
//           <SubmitButton loading={loading} />
//           <OAuthSection handleOAuthClick={} />
//           <p className="text-center text-sm text-muted-foreground">
//             Already have an account?{" "}
//             <Link href="/login" className="text-primary hover:underline">
//               Login
//             </Link>
//           </p>
//         </CardFooter>
//       </form>
//     </Card>
//   </motion.div>
// );
