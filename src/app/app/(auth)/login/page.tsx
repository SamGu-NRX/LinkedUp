import { Auth } from "@/components/auth";
import Navigation from "@/components/navigation";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />
      <div className="flex flex-1">
        <Auth mode="login" redirectTo="/" />
      </div>
    </div>
  );
}

// const [email, setEmail] = useState("");
// const [password, setPassword] = useState("");
// const [loading, setLoading] = useState(false);

// const { toast } = useToast();
// const router = useRouter();

// async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
//   e.preventDefault();
//   setLoading(true);

//   const formData = new FormData(e.currentTarget);

//   const result = await loginAction(formData);

//   setLoading(false);

//   if (result?.error) {
//     console.error("Login error:", result.status, result.error);

//     if (result.status && result.status >= 500) {
//       // server error
//       toast({
//         title: "Server error. Please try again later.",
//         description: result.error,
//         variant: "destructive",
//       });
//     } else {
//       // user error
//       toast({
//         title: "Failed to login. Please check your credentials and try again.",
//         description: result.error,
//         variant: "destructive",
//       });
//     }
//     return;
//   }

//   // success
//   toast({
//     title: "Success",
//     description: "You have been logged in successfully!",
//   });
//   router.push("/"); // or wherever
// }
