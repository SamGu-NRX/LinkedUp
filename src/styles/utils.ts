import { colors } from "./colors"

export const utils = {
  gradientBg: `bg-gradient-to-b from-[${colors.background}] to-[${colors.surface}]`,
  cardBg: `bg-[${colors.surface}]`,
  textPrimary: `text-[${colors.text.primary}]`,
  textSecondary: `text-[${colors.text.secondary}]`,
  buttonPrimary: `bg-[${colors.primary}] hover:bg-[${colors.primary}]/80`,
  buttonSecondary: `bg-[${colors.secondary}] hover:bg-[${colors.secondary}]/80`,
  buttonAccent: `bg-[${colors.accent}] hover:bg-[${colors.accent}]/80`,
}

