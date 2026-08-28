"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const dark = mounted && resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(dark ? "light" : "dark")}
      title={dark ? "Auf hell umschalten" : "Auf dunkel umschalten"}
      aria-label={dark ? "Auf hell umschalten" : "Auf dunkel umschalten"}
    >
      {dark ? <Sun /> : <Moon />}
    </Button>
  );
}
