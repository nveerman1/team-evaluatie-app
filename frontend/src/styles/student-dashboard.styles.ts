/**
 * Student Dashboard Design System
 * 
 * Centralized styling utilities for consistent UI/UX across all student pages.
 * Based on the redesigned student dashboard mockup.
 */

/**
 * LAYOUT CLASSES
 * Full-width container with consistent max-width and padding
 */
export const studentLayout = {
  // Main page container
  pageContainer: "min-h-screen bg-slate-100",
  
  // Content wrapper with max-width
  contentWrapper: "mx-auto w-full max-w-6xl px-4 py-6 sm:px-6",
  
  // Tab content spacing
  tabContent: "mt-6 space-y-4",
} as const;

/**
 * HEADER CLASSES
 * Dark header with title, subtitle, and user info
 */
export const studentHeader = {
  // Full-width header container
  container: "w-full bg-slate-800 text-white shadow-sm",
  
  // Inner wrapper
  wrapper: "mx-auto w-full max-w-6xl px-4 py-6 sm:px-6",
  
  // Flex container for title and user info
  flexContainer: "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
  
  // Title section (left side)
  titleSection: "text-left",
  title: "text-3xl font-bold tracking-tight",
  subtitle: "mt-1 max-w-xl text-sm text-white/70",
  
  // User info section (right side)
  userSection: "flex items-center gap-3 sm:self-start",
  userInfo: "text-right",
  userName: "text-sm font-semibold",
  userClass: "text-xs text-white/70",
  userAvatar: "flex h-10 w-10 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/20 font-semibold",
} as const;

/**
 * NAVIGATION CLASSES
 * Tabs with search functionality
 */
export const studentNavigation = {
  // Container for tabs and search
  container: "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
  
  // Tabs list styling
  tabsList: "h-11 w-full justify-start gap-1 rounded-2xl bg-white p-1 shadow-sm sm:w-auto",
  
  // Individual tab trigger
  tabTrigger: "relative rounded-xl px-4 data-[state=active]:bg-slate-800 data-[state=active]:text-white data-[state=active]:shadow-sm",
  
  // Tab content wrapper
  tabContent: "mt-6 space-y-4",
  
  // Search input container
  searchContainer: "relative w-full sm:w-72",
  searchIcon: "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400",
  searchInput: "h-11 rounded-2xl bg-white pl-9 shadow-sm ring-1 ring-slate-200 focus-visible:ring-2 focus-visible:ring-indigo-500",
} as const;

/**
 * CARD CLASSES
 * Two types: Info cards (bg-slate-50, no shadow) and List item cards (bg-white, with hover)
 */
export const studentCards = {
  // Info cards (introductory/explanatory cards at top of tabs)
  infoCard: {
    container: "rounded-2xl border-slate-200 bg-slate-50",
    content: "p-5",
    flexContainer: "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
    leftSection: "space-y-1 flex-1",
    titleRow: "flex items-center gap-2",
    icon: "h-4 w-4 text-slate-600",
    title: "text-sm font-semibold text-slate-900",
    subtitle: "text-sm text-slate-600",
    rightSection: "flex items-center gap-2 shrink-0",
  },
  
  // List item cards (evaluations, scans, assessments, etc.)
  listCard: {
    container: "rounded-2xl border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow",
    content: "p-5",
    flexContainer: "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
    leftSection: "min-w-0 flex-1 space-y-2",
    rightSection: "flex shrink-0 items-start gap-2 sm:justify-end",
  },
} as const;

/**
 * BADGE CLASSES
 * Status indicators and pills
 */
export const studentBadges = {
  // Status badges
  statusOpen: "rounded-full bg-slate-900 text-white",
  statusClosed: "rounded-full bg-slate-100 text-slate-700",
  
  // Info badges/pills
  infoPill: "rounded-full bg-indigo-50 text-indigo-700",
  infoPillHover: "rounded-full bg-indigo-50 text-indigo-700 cursor-pointer hover:bg-indigo-100",
  
  // Result/grade badges
  gradeBadge: "inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700",
  
  // Learning goal status
  activeGoal: "rounded-full bg-amber-50 text-amber-800 border border-amber-100",
  completedGoal: "rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100",
} as const;

/**
 * BUTTON CLASSES
 * Primary, secondary, and ghost button variants
 */
export const studentButtons = {
  // Primary action button (dark)
  primary: "rounded-xl bg-slate-900 hover:bg-slate-800",
  primarySmall: "rounded-xl bg-slate-900 hover:bg-slate-800",
  
  // Secondary button (light)
  secondary: "rounded-xl",
  secondarySmall: "rounded-xl",
  
  // Ghost button (transparent)
  ghost: "rounded-xl text-slate-700",
  ghostSmall: "rounded-xl text-slate-700",
} as const;

/**
 * PROGRESS CLASSES
 * Progress bars and indicators
 */
export const studentProgress = {
  // Standard progress bar
  container: "mt-3 max-w-md",
  bar: "h-3 [&>div]:bg-indigo-500",
  
  // Compact progress indicator
  compactContainer: "mt-2 max-w-sm",
  compactBar: "h-2 [&>div]:bg-indigo-500",
} as const;

/**
 * ACTION CHIPS CLASSES
 * Status indicators with icons (checkmark/clock)
 */
export const studentActionChips = {
  container: "mt-3 flex flex-col gap-0.5 sm:flex-row sm:gap-2",
  chip: "flex items-center gap-2 text-sm",
  iconDone: "h-4 w-4 text-emerald-600",
  iconPending: "h-4 w-4 text-slate-400",
  textDone: "text-emerald-700",
  textPending: "text-slate-600",
} as const;

/**
 * TYPOGRAPHY CLASSES
 * Consistent text styling across student pages
 */
export const studentTypography = {
  // Page titles
  pageTitle: "text-3xl font-bold tracking-tight text-slate-900",
  pageSubtitle: "mt-1 text-sm text-slate-600",
  
  // Section headers
  sectionTitle: "text-lg font-semibold text-slate-900",
  sectionSubtitle: "text-sm text-slate-600",
  
  // Card titles
  cardTitle: "text-base font-semibold text-slate-900",
  cardSubtitle: "text-sm text-slate-600",
  
  // Info text
  infoText: "text-sm text-slate-600",
  infoTextSmall: "text-xs text-slate-600",
  
  // Metadata/labels
  metaText: "text-sm text-slate-700",
  metaTextSmall: "text-xs text-slate-600",
} as const;

/**
 * TABLE CLASSES
 * Data tables for project results, etc.
 */
export const studentTables = {
  container: "overflow-x-auto rounded-xl border",
  table: "min-w-full text-sm",
  thead: "bg-slate-50",
  theadRow: "text-left text-xs font-semibold uppercase tracking-wide text-slate-600",
  th: "px-4 py-3",
  thRight: "px-4 py-3 text-right",
  tbody: "",
  tr: "border-t",
  td: "px-4 py-3",
  tdRight: "px-4 py-3 text-right",
} as const;

/**
 * UTILITY FUNCTIONS
 * Helper functions for conditional styling
 */
export const studentUtils = {
  /**
   * Get status badge className based on status
   */
  getStatusBadge: (isOpen: boolean) => 
    isOpen ? studentBadges.statusOpen : studentBadges.statusClosed,
  
  /**
   * Get status text based on status
   */
  getStatusText: (isOpen: boolean) => 
    isOpen ? "Open" : "Gesloten",
  
  /**
   * Combine multiple className strings
   */
  cn: (...classes: (string | undefined | false)[]) => 
    classes.filter(Boolean).join(" "),
} as const;

/**
 * OVERVIEW TAB SPECIFIC CLASSES
 * Special components for the Overzicht/Overview tab
 */
export const studentOverview = {
  // StatPill component
  statPill: "flex items-center gap-2 rounded-full border bg-white/70 px-3 py-1 text-sm shadow-sm",
  statIcon: "text-slate-600",
  statLabel: "text-slate-600",
  statValue: "font-semibold text-slate-900",
  
  // ScoreRow component
  scoreRow: {
    container: "space-y-1",
    flexContainer: "flex items-center justify-between text-sm",
    label: "text-slate-600",
    value: "font-semibold text-slate-900",
  },
  
  // OMZA teacher badges
  omzaTeacher: {
    container: "flex items-center gap-2",
    letter: "text-xs font-semibold text-slate-500",
    badgeBase: "inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold",
    badgeGood: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    badgeV: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    badgeLetop: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
    badgeUrgent: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
  },
  
  // Radar chart container
  radarContainer: "h-72 w-full",
  
  // Learning goals list
  goalsList: "space-y-3",
  goalItem: "flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between",
  goalTitle: "truncate text-sm font-semibold text-slate-900",
  goalMeta: "text-xs text-slate-600",
  
  // Reflections list
  reflectionsList: "space-y-2",
  reflectionItem: "w-full rounded-xl border p-3 text-left hover:bg-slate-50",
  reflectionTitle: "truncate text-sm font-semibold text-slate-900",
  reflectionMeta: "text-xs text-slate-600",
} as const;

/**
 * EXPORT ALL
 * Export a single object with all style classes
 */
export const studentStyles = {
  layout: studentLayout,
  header: studentHeader,
  navigation: studentNavigation,
  cards: studentCards,
  badges: studentBadges,
  buttons: studentButtons,
  progress: studentProgress,
  actionChips: studentActionChips,
  typography: studentTypography,
  tables: studentTables,
  overview: studentOverview,
  utils: studentUtils,
} as const;

export default studentStyles;
