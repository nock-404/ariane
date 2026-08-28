import { DEFAULT_THEME, themeCss } from "@/lib/themes";

/**
 * Das Thema muss vor dem ersten Anstrich stehen, sonst blitzt kurz das
 * Standardthema durch. Deshalb ein winziges Skript im Kopf, das denselben
 * Speicher liest wie der Zustand der Oberfläche.
 */
export function SkinBoot() {
  const script = `try{var s=JSON.parse(localStorage.getItem("ariane-ansicht")||"{}");var v=s&&s.state&&s.state.skin;document.documentElement.dataset.skin=v||"${DEFAULT_THEME}";}catch(e){document.documentElement.dataset.skin="${DEFAULT_THEME}";}`;
  return (
    <>
      <style id="ariane-skins" dangerouslySetInnerHTML={{ __html: themeCss() }} />
      <script dangerouslySetInnerHTML={{ __html: script }} />
    </>
  );
}
