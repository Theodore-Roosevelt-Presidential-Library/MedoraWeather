// TRPL Brand tokens — from the official Brand Identity System & Guidelines.
// Background is always white per direction. Accent colors are used for
// headline text / icons only; body text is Dark Gray.

export const COLORS = {
  // Primary (backgrounds / structure)
  darkGray: '#25282A',
  white: '#FFFFFF',
  sand: '#D1CCBD',
  deepOrange: '#E7805D',
  // Grounding
  darkForest: '#1B4532',
  nightSky: '#092A4D',
  brightForest: '#8FC895',
  graySky: '#99ADC5',
  // Accent (headline text only)
  sunsetPink: '#F36079',
  sunsetOrange: '#FC924E',
  sunsetYellow: '#F9D635',
  springGreen: '#87BB41'
};

// Roles used throughout the widget + images.
export const ROLE = {
  bg: COLORS.white,
  text: COLORS.darkGray,
  textMuted: '#6B6E70',
  hairline: '#E7E4DC',        // a light tint of Sand for borders on white
  panel: '#FBFAF7',           // near-white sand tint for inner panels
  sun: COLORS.sunsetYellow,
  sunEdge: COLORS.sunsetOrange,
  cloud: COLORS.graySky,
  cloudDark: '#7A8CA3',
  rain: COLORS.nightSky,
  rainDrop: '#3E6FA3',
  snow: COLORS.graySky,
  storm: COLORS.sunsetYellow,
  night: COLORS.nightSky,
  fog: COLORS.graySky,
  good: COLORS.springGreen,
  hot: COLORS.deepOrange,
  headline: COLORS.deepOrange
};

// Font stacks. Brand fonts are self-hosted (see /fonts). Dharma Gothic is
// display/titling and ALL CAPS only; Clearface is the serif body face.
export const FONTS = {
  display: "'Dharma Gothic E', 'Oswald', 'Arial Narrow', sans-serif",
  serif: "'ITC Clearface Std', Georgia, 'Times New Roman', serif",
  sans: "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
};
