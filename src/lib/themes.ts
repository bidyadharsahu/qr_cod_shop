// Occasion-based theming system (like Amazon seasonal themes)
// Auto-detects current season, holiday, or time of day

export interface AppTheme {
  id: string;
  name: string;
  occasion: string;
  emoji: string;
  greeting: string;
  // CSS custom properties
  primary: string;
  primaryLight: string;
  primaryDark: string;
  accent: string;
  headerGradient: string;
  buttonGradient: string;
  bgGlow: string;
  // Chat bubble colors
  botBubbleBg: string;
  botBubbleBorder: string;
  userBubbleBg: string;
}

const THEMES: Record<string, AppTheme> = {
  default: {
    id: 'default',
    occasion: 'default',
    name: 'Classic Gold',
    emoji: '✨',
    greeting: 'What can I get you tonight?',
    primary: '#d4af37',
    primaryLight: '#f4e4bc',
    primaryDark: '#996515',
    accent: '#f59e0b',
    headerGradient: 'linear-gradient(135deg, rgba(212,175,55,0.1), rgba(10,10,10,0.95))',
    buttonGradient: 'linear-gradient(135deg, #d4af37, #996515)',
    bgGlow: 'rgba(212,175,55,0.08)',
    botBubbleBg: 'rgb(24,24,27)',
    botBubbleBorder: 'rgb(39,39,42)',
    userBubbleBg: '#d4af37',
  },
  newyear: {
    id: 'newyear',
    occasion: 'holiday',
    name: 'New Year Celebration',
    emoji: '🎆',
    greeting: 'Happy New Year! 🎆 Let\'s celebrate with something special!',
    primary: '#ffd700',
    primaryLight: '#fff8dc',
    primaryDark: '#daa520',
    accent: '#ff6b6b',
    headerGradient: 'linear-gradient(135deg, rgba(255,215,0,0.15), rgba(255,107,107,0.1), rgba(10,10,10,0.95))',
    buttonGradient: 'linear-gradient(135deg, #ffd700, #ff6b6b)',
    bgGlow: 'rgba(255,215,0,0.1)',
    botBubbleBg: 'rgb(30,20,20)',
    botBubbleBorder: 'rgba(255,215,0,0.2)',
    userBubbleBg: '#ffd700',
  },
  valentine: {
    id: 'valentine',
    occasion: 'holiday',
    name: 'Valentine\'s Special',
    emoji: '💕',
    greeting: 'Happy Valentine\'s! 💕 Something romantic tonight?',
    primary: '#e91e63',
    primaryLight: '#f8bbd0',
    primaryDark: '#c2185b',
    accent: '#ff4081',
    headerGradient: 'linear-gradient(135deg, rgba(233,30,99,0.15), rgba(10,10,10,0.95))',
    buttonGradient: 'linear-gradient(135deg, #e91e63, #c2185b)',
    bgGlow: 'rgba(233,30,99,0.08)',
    botBubbleBg: 'rgb(30,20,25)',
    botBubbleBorder: 'rgba(233,30,99,0.2)',
    userBubbleBg: '#e91e63',
  },
  stpatricks: {
    id: 'stpatricks',
    occasion: 'holiday',
    name: 'St. Patrick\'s Day',
    emoji: '🍀',
    greeting: 'Happy St. Patrick\'s! 🍀 Time for some green drinks!',
    primary: '#4caf50',
    primaryLight: '#c8e6c9',
    primaryDark: '#2e7d32',
    accent: '#66bb6a',
    headerGradient: 'linear-gradient(135deg, rgba(76,175,80,0.15), rgba(10,10,10,0.95))',
    buttonGradient: 'linear-gradient(135deg, #4caf50, #2e7d32)',
    bgGlow: 'rgba(76,175,80,0.08)',
    botBubbleBg: 'rgb(20,30,20)',
    botBubbleBorder: 'rgba(76,175,80,0.2)',
    userBubbleBg: '#4caf50',
  },
  easter: {
    id: 'easter',
    occasion: 'holiday',
    name: 'Easter Spring',
    emoji: '🐣',
    greeting: 'Happy Easter! 🐣 Fresh spring drinks await!',
    primary: '#ab47bc',
    primaryLight: '#e1bee7',
    primaryDark: '#7b1fa2',
    accent: '#ffb74d',
    headerGradient: 'linear-gradient(135deg, rgba(171,71,188,0.15), rgba(255,183,77,0.08), rgba(10,10,10,0.95))',
    buttonGradient: 'linear-gradient(135deg, #ab47bc, #7b1fa2)',
    bgGlow: 'rgba(171,71,188,0.08)',
    botBubbleBg: 'rgb(25,20,30)',
    botBubbleBorder: 'rgba(171,71,188,0.2)',
    userBubbleBg: '#ab47bc',
  },
  summer: {
    id: 'summer',
    occasion: 'seasonal',
    name: 'Summer Vibes',
    emoji: '🌴',
    greeting: 'Summer vibes! 🌴 What\'s your refreshing pick?',
    primary: '#ff9800',
    primaryLight: '#ffe0b2',
    primaryDark: '#e65100',
    accent: '#00bcd4',
    headerGradient: 'linear-gradient(135deg, rgba(255,152,0,0.15), rgba(0,188,212,0.08), rgba(10,10,10,0.95))',
    buttonGradient: 'linear-gradient(135deg, #ff9800, #e65100)',
    bgGlow: 'rgba(255,152,0,0.1)',
    botBubbleBg: 'rgb(30,25,20)',
    botBubbleBorder: 'rgba(255,152,0,0.2)',
    userBubbleBg: '#ff9800',
  },
  halloween: {
    id: 'halloween',
    occasion: 'holiday',
    name: 'Halloween Night',
    emoji: '🎃',
    greeting: 'Boo! 🎃 Ready for some spooky cocktails?',
    primary: '#ff6f00',
    primaryLight: '#ffcc02',
    primaryDark: '#e65100',
    accent: '#7c4dff',
    headerGradient: 'linear-gradient(135deg, rgba(255,111,0,0.15), rgba(124,77,255,0.08), rgba(10,10,10,0.95))',
    buttonGradient: 'linear-gradient(135deg, #ff6f00, #e65100)',
    bgGlow: 'rgba(255,111,0,0.1)',
    botBubbleBg: 'rgb(25,20,15)',
    botBubbleBorder: 'rgba(255,111,0,0.3)',
    userBubbleBg: '#ff6f00',
  },
  thanksgiving: {
    id: 'thanksgiving',
    occasion: 'holiday',
    name: 'Thanksgiving',
    emoji: '🦃',
    greeting: 'Happy Thanksgiving! 🦃 Grateful for your visit!',
    primary: '#bf360c',
    primaryLight: '#ffccbc',
    primaryDark: '#8d1c06',
    accent: '#ff8f00',
    headerGradient: 'linear-gradient(135deg, rgba(191,54,12,0.15), rgba(255,143,0,0.08), rgba(10,10,10,0.95))',
    buttonGradient: 'linear-gradient(135deg, #bf360c, #8d1c06)',
    bgGlow: 'rgba(191,54,12,0.08)',
    botBubbleBg: 'rgb(30,20,18)',
    botBubbleBorder: 'rgba(191,54,12,0.2)',
    userBubbleBg: '#bf360c',
  },
  christmas: {
    id: 'christmas',
    occasion: 'holiday',
    name: 'Christmas Magic',
    emoji: '🎄',
    greeting: 'Merry Christmas! 🎄 Hot cocoa or something festive?',
    primary: '#c62828',
    primaryLight: '#ffcdd2',
    primaryDark: '#b71c1c',
    accent: '#2e7d32',
    headerGradient: 'linear-gradient(135deg, rgba(198,40,40,0.15), rgba(46,125,50,0.08), rgba(10,10,10,0.95))',
    buttonGradient: 'linear-gradient(135deg, #c62828, #b71c1c)',
    bgGlow: 'rgba(198,40,40,0.08)',
    botBubbleBg: 'rgb(30,18,18)',
    botBubbleBorder: 'rgba(198,40,40,0.2)',
    userBubbleBg: '#c62828',
  },
  july4th: {
    id: 'july4th',
    occasion: 'holiday',
    name: '4th of July',
    emoji: '🇺🇸',
    greeting: 'Happy 4th! 🇺🇸 Let\'s celebrate freedom with a drink!',
    primary: '#1565c0',
    primaryLight: '#bbdefb',
    primaryDark: '#0d47a1',
    accent: '#d32f2f',
    headerGradient: 'linear-gradient(135deg, rgba(21,101,192,0.15), rgba(211,47,47,0.08), rgba(10,10,10,0.95))',
    buttonGradient: 'linear-gradient(135deg, #1565c0, #0d47a1)',
    bgGlow: 'rgba(21,101,192,0.08)',
    botBubbleBg: 'rgb(18,20,30)',
    botBubbleBorder: 'rgba(21,101,192,0.2)',
    userBubbleBg: '#1565c0',
  },
  // Time-of-day themes
  morning: {
    id: 'morning',
    occasion: 'time',
    name: 'Good Morning',
    emoji: '☀️',
    greeting: 'Good morning! ☀️ Start your day with us!',
    primary: '#ff8f00',
    primaryLight: '#fff3e0',
    primaryDark: '#e65100',
    accent: '#ffc107',
    headerGradient: 'linear-gradient(135deg, rgba(255,143,0,0.15), rgba(10,10,10,0.95))',
    buttonGradient: 'linear-gradient(135deg, #ff8f00, #e65100)',
    bgGlow: 'rgba(255,143,0,0.08)',
    botBubbleBg: 'rgb(30,25,20)',
    botBubbleBorder: 'rgba(255,143,0,0.2)',
    userBubbleBg: '#ff8f00',
  },
  latenight: {
    id: 'latenight',
    occasion: 'time',
    name: 'Late Night',
    emoji: '🌙',
    greeting: 'Night owl! 🌙 Our best cocktails are waiting.',
    primary: '#7c4dff',
    primaryLight: '#d1c4e9',
    primaryDark: '#651fff',
    accent: '#00e5ff',
    headerGradient: 'linear-gradient(135deg, rgba(124,77,255,0.15), rgba(0,229,255,0.05), rgba(10,10,10,0.95))',
    buttonGradient: 'linear-gradient(135deg, #7c4dff, #651fff)',
    bgGlow: 'rgba(124,77,255,0.08)',
    botBubbleBg: 'rgb(20,18,30)',
    botBubbleBorder: 'rgba(124,77,255,0.2)',
    userBubbleBg: '#7c4dff',
  },
  weekend: {
    id: 'weekend',
    occasion: 'time',
    name: 'Weekend Party',
    emoji: '🎉',
    greeting: 'Weekend vibes! 🎉 Let\'s make tonight legendary!',
    primary: '#e91e63',
    primaryLight: '#fce4ec',
    primaryDark: '#880e4f',
    accent: '#ffd54f',
    headerGradient: 'linear-gradient(135deg, rgba(233,30,99,0.12), rgba(255,213,79,0.06), rgba(10,10,10,0.95))',
    buttonGradient: 'linear-gradient(135deg, #e91e63, #880e4f)',
    bgGlow: 'rgba(233,30,99,0.08)',
    botBubbleBg: 'rgb(28,18,22)',
    botBubbleBorder: 'rgba(233,30,99,0.2)',
    userBubbleBg: '#e91e63',
  },
  miamisunday: {
    id: 'miamisunday',
    occasion: 'weekend',
    name: 'Miami Sunday',
    emoji: '🌴',
    greeting: 'Sunday in Tampa with Miami vibes. Let\'s make it bright and smooth.',
    primary: '#00c2ff',
    primaryLight: '#b8f1ff',
    primaryDark: '#006b8f',
    accent: '#ff5fa2',
    headerGradient: 'linear-gradient(135deg, rgba(0,194,255,0.14), rgba(255,95,162,0.1), rgba(10,10,10,0.95))',
    buttonGradient: 'linear-gradient(135deg, #00c2ff, #ff5fa2)',
    bgGlow: 'rgba(0,194,255,0.12)',
    botBubbleBg: 'rgb(14,23,31)',
    botBubbleBorder: 'rgba(0,194,255,0.28)',
    userBubbleBg: '#00c2ff',
  },
};

export function getCurrentTheme(): AppTheme {
  const tampaNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const month = tampaNow.getMonth(); // 0-11
  const day = tampaNow.getDate();
  const dayOfWeek = tampaNow.getDay(); // 0=Sun, 6=Sat
  const hour = tampaNow.getHours();

  // Holiday themes (exact dates take priority)
  // New Year (Dec 28 - Jan 5)
  if ((month === 11 && day >= 28) || (month === 0 && day <= 5)) return THEMES.newyear;
  // Valentine's (Feb 10-14)
  if (month === 1 && day >= 10 && day <= 14) return THEMES.valentine;
  // St. Patrick's (Mar 14-17)
  if (month === 2 && day >= 14 && day <= 17) return THEMES.stpatricks;
  // Easter (roughly late March - April, simplified)
  if (month === 2 && day >= 28) return THEMES.easter;
  if (month === 3 && day <= 10) return THEMES.easter;
  // 4th of July (Jul 1-4)
  if (month === 6 && day >= 1 && day <= 4) return THEMES.july4th;
  // Halloween (Oct 25-31)
  if (month === 9 && day >= 25) return THEMES.halloween;
  // Thanksgiving (Nov 20-28, approximate)
  if (month === 10 && day >= 20 && day <= 28) return THEMES.thanksgiving;
  // Christmas (Dec 15-27)
  if (month === 11 && day >= 15 && day <= 27) return THEMES.christmas;

  // Sunday gets a special Miami-style weekend experience.
  if (dayOfWeek === 0) {
    return THEMES.miamisunday;
  }

  // Weekend theme (Fri evening and Saturday)
  if ((dayOfWeek === 5 && hour >= 17) || dayOfWeek === 6) {
    return THEMES.weekend;
  }

  // Time-of-day themes
  if (hour >= 6 && hour < 11) return THEMES.morning;
  if (hour >= 22 || hour < 4) return THEMES.latenight;

  // Seasonal fallback
  if (month >= 5 && month <= 7) return THEMES.summer; // Jun-Aug

  // Default
  return THEMES.default;
}

export function applyTheme(theme: AppTheme) {
  const root = document.documentElement;
  root.style.setProperty('--theme-primary', theme.primary);
  root.style.setProperty('--theme-primary-light', theme.primaryLight);
  root.style.setProperty('--theme-primary-dark', theme.primaryDark);
  root.style.setProperty('--theme-accent', theme.accent);
  root.style.setProperty('--theme-header-gradient', theme.headerGradient);
  root.style.setProperty('--theme-button-gradient', theme.buttonGradient);
  root.style.setProperty('--theme-bg-glow', theme.bgGlow);
  root.style.setProperty('--theme-bot-bubble-bg', theme.botBubbleBg);
  root.style.setProperty('--theme-bot-bubble-border', theme.botBubbleBorder);
  root.style.setProperty('--theme-user-bubble-bg', theme.userBubbleBg);
}

export { THEMES };
