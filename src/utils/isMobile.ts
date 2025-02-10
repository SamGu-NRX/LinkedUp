import { useState, useEffect } from "react";

export const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false); // Default to false

  useEffect(() => {
    if (typeof window !== "undefined") {
      const checkIsMobile = () => setIsMobile(window.innerWidth < 768);

      checkIsMobile(); // Set initial value

      const handleResize = () => checkIsMobile();

      window.addEventListener("resize", handleResize);

      return () => window.removeEventListener("resize", handleResize);
    }
  }, []);

  return isMobile;
};
