"use client";

import { useEffect } from "react";

/** Adds a class on <html> so marketing-only scrollbar styles apply only on /home. */
export function MarketingBodyClass() {
  useEffect(() => {
    document.documentElement.classList.add("marketing-scroll");
    return () => document.documentElement.classList.remove("marketing-scroll");
  }, []);
  return null;
}
