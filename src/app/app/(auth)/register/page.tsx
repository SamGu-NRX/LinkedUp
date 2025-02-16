import { Auth } from "@/components/auth";
import Navigation from "@/components/navigation";

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />
      <div className="flex flex-1">
        <Auth mode="register" redirectTo="/" />
      </div>
    </div>
  );
}

// const [loading, setLoading] = useState(false);
// const { toast } = useToast();

// // This is the function we'll pass into AuthForm
// async function handleRegister({
//   firstName,
//   lastName,
//   email,
//   password,
//   confirmPassword,
// }: {
//   firstName: string;
//   lastName: string;
//   email: string;
//   password: string;
//   confirmPassword?: string;
// }) {
//   // For example, ensure passwords match
//   if (password !== confirmPassword) {
//     toast({
//       title: "Error",
//       description: "Passwords do not match.",
//       variant: "destructive",
//     });
//     return;
//   }

//   setLoading(true);
//   try {
//     // Build your FormData the way your registerAction expects:
//     const formData = new FormData();
//     formData.set("fullName", `${firstName} ${lastName}`);
//     formData.set("email", email);
//     formData.set("password", password);
//     // If you want roles, e.g. "student" vs "teacher", you can set it here:
//     formData.set("role", "student");

//     const result = await registerAction(formData);

//     if (result?.error) {
//       console.error("Registration error:", result.status, result.error);
//       if (result.status && result.status >= 500) {
//         toast({
//           title: "Server error",
//           description: result.error,
//           variant: "destructive",
//         });
//       } else {
//         toast({
//           title: "Oops!",
//           description: result.error,
//           variant: "destructive",
//         });
//       }
//       return;
//     }

//     // success
//     toast({
//       title: "Success",
//       description: "Your account has been created!",
//     });

//     revalidatePath("/", "layout");
//     redirect("/");
//   } catch (err) {
//     console.error(err);
//     toast({
//       title: "Error",
//       description: "Something went wrong, please try again.",
//       variant: "destructive",
//     });
//   } finally {
//     setLoading(false);
//   }
// }
