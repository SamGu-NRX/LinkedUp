export const BottomGradient = () => {
  return (
    <>
      <span className="absolute inset-x-0 -bottom-px block h-px w-full bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-0 transition duration-500 group-hover/btn:opacity-100" />
      <span className="absolute inset-x-10 -bottom-px mx-auto block h-px w-1/2 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-0 blur-sm transition duration-500 group-hover/btn:opacity-100" />
    </>
  );
};

export const LabelInputContainer: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => <div className="flex flex-col space-y-2">{children}</div>;

export const AmbientBackground: React.FC = () => (
  <div className="fixed inset-0 overflow-hidden">
    <div className="animate-drift absolute -right-40 -top-40 h-96 w-96 rounded-full bg-purple-500/20 blur-3xl" />
    <div className="animate-drift-slow absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-blue-500/20 blur-3xl" />
  </div>
);
