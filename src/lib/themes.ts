/**
 * Farbthemen, wie man sie aus Editoren kennt. Jedes Thema liefert denselben
 * Satz Atelier-Variablen für Hell und Dunkel — im Code steht deshalb
 * weiterhin nirgends eine Farbe, nur `var(--…)`.
 *
 * Die Projektfarben bleiben über alle Themen gleich: sie sind Identität und
 * dürfen nicht springen, nur weil jemand das Aussehen wechselt.
 */

export type Skin = {
  bg: string;
  surface: string;
  raised: string;
  ink: string;
  dim: string;
  faint: string;
  line: string;
  hair: string;
  /** Akzent der Oberfläche (Knöpfe, Auswahl, „genau voll"). */
  moss: string;
  mossSoft: string;
  /** Überlast. */
  crit: string;
  critSoft: string;
  /** Es wird eng. */
  warn: string;
};

export type Theme = {
  id: string;
  name: string;
  note: string;
  light: Skin;
  dark: Skin;
};

export const THEMES: Theme[] = [
  {
    id: "atelier",
    name: "Atelier",
    note: "Kühles Papier, Moos, Apricot. Der Hausentwurf.",
    light: {
      bg: "#eef1f1", surface: "#ffffff", raised: "#f6f8f8",
      ink: "#1c2523", dim: "#6a7a78", faint: "#9aa8a6",
      line: "#dde3e2", hair: "#e9eeed",
      moss: "#57795a", mossSoft: "#dbe5db",
      crit: "#c9663c", critSoft: "#f4ddd1", warn: "#c9a44e",
    },
    dark: {
      bg: "#141818", surface: "#1b2020", raised: "#212827",
      ink: "#e6eceb", dim: "#8b9c9a", faint: "#647573",
      line: "#2b3332", hair: "#232a29",
      moss: "#93b795", mossSoft: "#2f4233",
      crit: "#e8956b", critSoft: "#462f24", warn: "#d9bd72",
    },
  },
  {
    id: "nord",
    name: "Nord",
    note: "Arktisches Blaugrau, sehr ruhig.",
    light: {
      bg: "#eceff4", surface: "#ffffff", raised: "#f4f6f9",
      ink: "#2e3440", dim: "#5f6b7d", faint: "#98a3b3",
      line: "#dbe1e9", hair: "#e8ecf2",
      moss: "#5e81ac", mossSoft: "#d8e3ef",
      crit: "#bf616a", critSoft: "#f2dcde", warn: "#c1873f",
    },
    dark: {
      bg: "#2e3440", surface: "#343c4b", raised: "#3b4252",
      ink: "#eceff4", dim: "#a2acbd", faint: "#71809a",
      line: "#454f63", hair: "#3a4353",
      moss: "#88c0d0", mossSoft: "#3a4b58",
      crit: "#bf616a", critSoft: "#4b3238", warn: "#ebcb8b",
    },
  },
  {
    id: "solarized",
    name: "Solarized",
    note: "Warmes Papier, Cyanblau. Der Klassiker.",
    light: {
      bg: "#fdf6e3", surface: "#fffbf0", raised: "#f7f0dd",
      ink: "#073642", dim: "#657b83", faint: "#93a1a1",
      line: "#ece4cd", hair: "#f4eed9",
      moss: "#268bd2", mossSoft: "#d6e7f4",
      crit: "#cb4b16", critSoft: "#f7ddcd", warn: "#b58900",
    },
    dark: {
      bg: "#002b36", surface: "#073642", raised: "#0b414f",
      ink: "#eee8d5", dim: "#93a1a1", faint: "#5f7a80",
      line: "#0f4c5a", hair: "#093f4c",
      moss: "#2aa198", mossSoft: "#0d4a4b",
      crit: "#cb4b16", critSoft: "#40261a", warn: "#b58900",
    },
  },
  {
    id: "dracula",
    name: "Dracula",
    note: "Tiefes Violett auf Nachtblau.",
    light: {
      bg: "#f4f4f8", surface: "#ffffff", raised: "#eeeef4",
      ink: "#1f1f28", dim: "#65688a", faint: "#9ea1bb",
      line: "#e1e1ea", hair: "#eeeef4",
      moss: "#7c4dff", mossSoft: "#e4dbff",
      crit: "#d94060", critSoft: "#fadae1", warn: "#a97b00",
    },
    dark: {
      bg: "#282a36", surface: "#31333f", raised: "#383b4a",
      ink: "#f8f8f2", dim: "#a3a9c9", faint: "#6272a4",
      line: "#474a5c", hair: "#353845",
      moss: "#bd93f9", mossSoft: "#3d3358",
      crit: "#ff6e6e", critSoft: "#4a2b30", warn: "#e6c07b",
    },
  },
  {
    id: "gruvbox",
    name: "Gruvbox",
    note: "Retro-Warm, sandig, kräftig.",
    light: {
      bg: "#fbf1c7", surface: "#fffcf0", raised: "#f4e8bd",
      ink: "#3c3836", dim: "#7c6f64", faint: "#a89984",
      line: "#eaddb0", hair: "#f4ebc6",
      moss: "#427b58", mossSoft: "#dbe6d3",
      crit: "#af3a03", critSoft: "#f2ddcb", warn: "#b57614",
    },
    dark: {
      bg: "#282828", surface: "#32302f", raised: "#3c3836",
      ink: "#ebdbb2", dim: "#a89984", faint: "#7c6f64",
      line: "#504945", hair: "#3a3735",
      moss: "#8ec07c", mossSoft: "#354030",
      crit: "#fe8019", critSoft: "#4a3120", warn: "#d79921",
    },
  },
  {
    id: "tokyo",
    name: "Tokyo Night",
    note: "Indigo und Neonblau, städtisch.",
    light: {
      bg: "#e1e2e7", surface: "#ffffff", raised: "#eceef2",
      ink: "#343b58", dim: "#6172b0", faint: "#9aa5ce",
      line: "#d3d6e0", hair: "#e6e8ee",
      moss: "#2e7de9", mossSoft: "#d7e4fb",
      crit: "#e0407b", critSoft: "#fad9e4", warn: "#8f6c2e",
    },
    dark: {
      bg: "#1a1b26", surface: "#1f2335", raised: "#262b3f",
      ink: "#c0caf5", dim: "#8189af", faint: "#5b658f",
      line: "#313750", hair: "#262b3d",
      moss: "#7aa2f7", mossSoft: "#2c3557",
      crit: "#f7768e", critSoft: "#44283a", warn: "#e0af68",
    },
  },
  {
    id: "everforest",
    name: "Everforest",
    note: "Waldgrün und Leinen, sehr weich.",
    light: {
      bg: "#f3efda", surface: "#fdf9e8", raised: "#eeead2",
      ink: "#4c5a5f", dim: "#7e8c7c", faint: "#a2ae9c",
      line: "#e3dec3", hair: "#efead2",
      moss: "#8da101", mossSoft: "#e2e7cb",
      crit: "#f57d26", critSoft: "#f8e0cb", warn: "#c78a00",
    },
    dark: {
      bg: "#2d353b", surface: "#343f44", raised: "#3d484d",
      ink: "#d3c6aa", dim: "#9da9a0", faint: "#7a8478",
      line: "#475258", hair: "#3a464c",
      moss: "#a7c080", mossSoft: "#3c4841",
      crit: "#e67e80", critSoft: "#4a3336", warn: "#dbbc7f",
    },
  },
  {
    id: "rosepine",
    name: "Rosé Pine",
    note: "Gedämpftes Malve und Kiefer.",
    light: {
      bg: "#faf4ed", surface: "#fffaf3", raised: "#f2e9e1",
      ink: "#575279", dim: "#797593", faint: "#9893a5",
      line: "#e9ddd4", hair: "#f4ece4",
      moss: "#286983", mossSoft: "#d8e3e8",
      crit: "#b4637a", critSoft: "#f1dbe1", warn: "#ea9d34",
    },
    dark: {
      bg: "#191724", surface: "#1f1d2e", raised: "#26233a",
      ink: "#e0def4", dim: "#908caa", faint: "#6e6a86",
      line: "#332f47", hair: "#231f34",
      moss: "#9ccfd8", mossSoft: "#28394a",
      crit: "#eb6f92", critSoft: "#432a3a", warn: "#f6c177",
    },
  },
  {
    id: "github",
    name: "GitHub",
    note: "Neutral und nüchtern, wie gewohnt.",
    light: {
      bg: "#f6f8fa", surface: "#ffffff", raised: "#f0f3f6",
      ink: "#1f2328", dim: "#636c76", faint: "#8c959f",
      line: "#d8dee4", hair: "#eaeef2",
      moss: "#0969da", mossSoft: "#ddeeff",
      crit: "#cf222e", critSoft: "#ffe3e1", warn: "#9a6700",
    },
    dark: {
      bg: "#0d1117", surface: "#161b22", raised: "#1c2128",
      ink: "#e6edf3", dim: "#8d96a0", faint: "#6e7681",
      line: "#30363d", hair: "#21262d",
      moss: "#58a6ff", mossSoft: "#18314f",
      crit: "#f85149", critSoft: "#3d1d1c", warn: "#d29922",
    },
  },
  {
    id: "catppuccin",
    name: "Catppuccin",
    note: "Pastellig, lavendelfarben, freundlich.",
    light: {
      bg: "#eff1f5", surface: "#ffffff", raised: "#e6e9ef",
      ink: "#4c4f69", dim: "#6c6f85", faint: "#9ca0b0",
      line: "#dce0e8", hair: "#e9ebf0",
      moss: "#8839ef", mossSoft: "#e7dbfb",
      crit: "#d20f39", critSoft: "#f9dbe0", warn: "#df8e1d",
    },
    dark: {
      bg: "#1e1e2e", surface: "#232338", raised: "#313244",
      ink: "#cdd6f4", dim: "#a6adc8", faint: "#7f849c",
      line: "#414259", hair: "#2a2b3c",
      moss: "#cba6f7", mossSoft: "#3b3455",
      crit: "#f38ba8", critSoft: "#46293a", warn: "#f9e2af",
    },
  },
];

export const DEFAULT_THEME = "atelier";

export function themeById(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

function block(skin: Skin): string {
  return [
    `--bg:${skin.bg}`,
    `--surface:${skin.surface}`,
    `--raised:${skin.raised}`,
    `--ink:${skin.ink}`,
    `--dim:${skin.dim}`,
    `--faint:${skin.faint}`,
    `--line:${skin.line}`,
    `--hair:${skin.hair}`,
    `--moss:${skin.moss}`,
    `--moss-soft:${skin.mossSoft}`,
    `--crit:${skin.crit}`,
    `--crit-soft:${skin.critSoft}`,
    `--warn:${skin.warn}`,
  ].join(";");
}

/** Ein Stylesheet für alle Themen. Wird einmal im Grundgerüst ausgegeben. */
export function themeCss(): string {
  return THEMES.filter((t) => t.id !== DEFAULT_THEME)
    .map(
      (t) =>
        `:root[data-skin="${t.id}"]{${block(t.light)}}\n` +
        `:root[data-skin="${t.id}"].dark{${block(t.dark)}}`,
    )
    .join("\n");
}
