// components/auth/OAuth.tsx

import { Button } from "@/components/ui/button";
import {
  IconBrandGithub,
  IconBrandGoogle,
  IconBrandDiscord,
} from "@tabler/icons-react";
import { BottomGradient } from "./utils";
import { capitalize } from "@/lib/shadcn";

interface OAuthProvider {
  name: string;
  Icon: React.ComponentType<{ className?: string }>;
}

const oauthProviders: OAuthProvider[] = [
  { name: "gitHub", Icon: IconBrandGithub },
  { name: "google", Icon: IconBrandGoogle },
  { name: "discord", Icon: IconBrandDiscord },
];

interface OAuthButtonProps {
  Icon: React.ComponentType<{ className?: string }>;
  name: string;
  onClick: () => void;
}

const OAuthButton: React.FC<OAuthButtonProps> = ({ Icon, name, onClick }) => (
  <Button
    type="button"
    onClick={onClick}
    aria-label={`Continue with ${name}`}
    className="group/btn relative flex h-11 w-full items-center rounded-lg bg-gradient-to-br from-black to-neutral-600 px-4 font-medium text-slate-200 shadow-[0px_1px_0px_0px_#ffffff40_inset,0px_-1px_0px_0px_#ffffff40_inset] backdrop-blur-sm transition-colors hover:text-white dark:bg-black/40 dark:from-zinc-800 dark:to-zinc-900 dark:text-gray-300 dark:shadow-[0px_1px_0px_0px_var(--zinc-800)_inset,0px_-1px_0px_0px_var(--zinc-800)_inset]"
  >
    <span className="absolute left-4 md:left-8">
      <Icon className="h-6 w-6" />
    </span>
    <span className="flex-1 text-center">Continue with {name}</span>
    <div className="ml-auto">
      <BottomGradient />
    </div>
  </Button>
);

interface OAuthSectionProps {
  handleOAuthClick: (providerName: string) => void;
}

const OAuthSection: React.FC<OAuthSectionProps> = ({ handleOAuthClick }) => {
  return (
    <>
      <div className="flex w-full items-center text-sm">
        <div className="h-[1px] flex-grow bg-gradient-to-r from-transparent to-neutral-300 dark:to-neutral-700" />
        <span className="mx-4 text-neutral-500">or continue with</span>
        <div className="h-[1px] flex-grow bg-gradient-to-l from-transparent to-neutral-300 dark:to-neutral-700" />
      </div>

      <div className="grid w-full grid-cols-1 gap-3">
        {oauthProviders.map((provider) => (
          <OAuthButton
            key={provider.name}
            Icon={provider.Icon}
            name={capitalize(provider.name)}
            onClick={() => handleOAuthClick(provider.name)}
          />
        ))}
      </div>
    </>
  );
};

export default OAuthSection;
