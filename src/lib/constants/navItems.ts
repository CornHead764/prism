import {
  Home,
  Calendar,
  CheckSquare,
  ClipboardList,
  Trophy,
  ShoppingCart,
  UtensilsCrossed,
  ChefHat,
  MessageSquare,
  ImageIcon,
  Gift,
  Baby,
  Settings,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

/** All navigation items in canonical order. */
export const ALL_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: Home },
  { label: 'Calendar', href: '/calendar', icon: Calendar },
  { label: 'Tasks', href: '/tasks', icon: CheckSquare },
  { label: 'Chores', href: '/chores', icon: ClipboardList },
  { label: 'Goals', href: '/goals', icon: Trophy },
  { label: 'Shopping', href: '/shopping', icon: ShoppingCart },
  { label: 'Meals', href: '/meals', icon: UtensilsCrossed },
  { label: 'Recipes', href: '/recipes', icon: ChefHat },
  { label: 'Messages', href: '/messages', icon: MessageSquare },
  { label: 'Photos', href: '/photos', icon: ImageIcon },
  { label: 'Wishes', href: '/wishes', icon: Gift },
  { label: 'Babysitter', href: '/babysitter', icon: Baby },
  { label: 'Settings', href: '/settings', icon: Settings },
];

/** Pages that can never be hidden. */
export const ALWAYS_VISIBLE_HREFS = new Set(['/', '/settings']);

/** Pages that are hideable (for the Features settings UI). */
export const HIDEABLE_NAV_ITEMS = ALL_NAV_ITEMS.filter(
  (item) => !ALWAYS_VISIBLE_HREFS.has(item.href)
);
