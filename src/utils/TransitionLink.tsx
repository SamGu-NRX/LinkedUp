"use client";
import Link, { LinkProps } from "next/link";
import React from "react";
import { useRouter } from "next/navigation";

interface TransitionLinkProps extends LinkProps {
  children: React.ReactNode;
  href: string;
  className?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const handleTransition = async (
  e: React.MouseEvent<HTMLAnchorElement, MouseEvent>,
  href: string,
  router: ReturnType<typeof useRouter>
) => {
  e.preventDefault();
  const body = document.querySelector("body");

  // console.log("[TransitionLink] Adding .page-transition class");
  body?.classList.add("page-transition");

  await sleep(500);

  // console.log("[TransitionLink] Before router.push");
  router.push(href);

  await sleep(500);

  // console.log("[TransitionLink] Removing .page-transition class");
  body?.classList.remove("page-transition");
};

export const TransitionLink: React.FC<TransitionLinkProps> = ({
  children,
  href,
  className,
  ...props
}) => {
  const router = useRouter();

  return (
    <Link
      {...props}
      href={href}
      onClick={(e) => handleTransition(e, href, router)}
      className={className}
    >
      {children}
    </Link>
  );
};
