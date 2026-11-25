"use client";

import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Opens the first settings tab this person may see. */
export default function SettingsIndexPage() {
  const router = useRouter();
  const { can } = useAuth();

  useEffect(() => {
    const first = can("settings.manage") ? "general" : can("logs.view") ? "logs" : can("audit.view") ? "audit" : null;
    router.replace(first ? `/settings/${first}` : "/dashboard");
  }, [can, router]);

  return null;
}
