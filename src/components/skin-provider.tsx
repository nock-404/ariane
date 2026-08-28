"use client";

import { useEffect } from "react";

import { usePrefs } from "@/lib/prefs";

/** Setzt das gewählte Farbthema als `data-skin` am Wurzelelement. */
export function SkinProvider() {
  const skin = usePrefs((s) => s.skin);

  useEffect(() => {
    document.documentElement.dataset.skin = skin;
  }, [skin]);

  return null;
}
