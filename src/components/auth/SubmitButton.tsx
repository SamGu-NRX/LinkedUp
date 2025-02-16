import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { BottomGradient } from "./utils";

const SubmitButton: React.FC<{
  loading: boolean;
  mode: "register" | "login";
}> = ({ loading, mode }) => (
  <Button
    type="submit"
    className="group/btn relative h-11 w-full rounded-lg bg-gradient-to-br from-black to-neutral-600 font-medium text-slate-200 shadow-[0px_1px_0px_0px_#ffffff40_inset,0px_-1px_0px_0px_#ffffff40_inset] hover:text-white dark:from-zinc-800 dark:to-zinc-900 dark:shadow-[0px_1px_0px_0px_var(--zinc-800)_inset,0px_-1px_0px_0px_var(--zinc-800)_inset]"
    disabled={loading}
  >
    {loading ? (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center justify-center"
      >
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </motion.div>
    ) : (
      <span className="flex items-center justify-center">
        {mode === "register" ? "Create account" : "Sign in"}
        <span className="ml-1 inline-block transition-transform duration-200 group-hover/btn:translate-x-[5px]">
          →
        </span>
      </span>
    )}
    <BottomGradient />
  </Button>
);

export default SubmitButton;
