import {
  BarChart3,
  Database,
  Globe,
  Info,
  MonitorCog,
  RadioTower,
  Share2,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react';

export type SettingsSection =
  'radio' | 'local' | 'community' | 'radio-app' | 'database' | 'fanout' | 'statistics' | 'about';

export const SETTINGS_SECTION_ORDER: SettingsSection[] = [
  'radio',
  'local',
  'community',
  'fanout',
  'radio-app',
  'database',
  'statistics',
  'about',
];

/** i18n key ids. Translate at render with t(SETTINGS_SECTION_LABELS[section]). */
export const SETTINGS_SECTION_LABELS: Record<SettingsSection, string> = {
  radio: 'settingsNav.radio',
  local: 'settingsNav.local',
  community: 'settingsNav.community',
  'radio-app': 'settingsNav.radioApp',
  database: 'settingsNav.database',
  fanout: 'settingsNav.fanout',
  statistics: 'settingsNav.statistics',
  about: 'settingsNav.about',
};

export const SETTINGS_SECTION_ICONS: Record<SettingsSection, LucideIcon> = {
  radio: RadioTower,
  local: MonitorCog,
  community: Globe,
  'radio-app': SlidersHorizontal,
  database: Database,
  fanout: Share2,
  statistics: BarChart3,
  about: Info,
};
