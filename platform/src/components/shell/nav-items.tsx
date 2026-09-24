"use client";

import {
  LayoutDashboard,
  Package,
  KeyRound,
  Users,
  Bot,
  MessageSquareText,
  ScrollText,
  Settings,
  ShoppingCart,
  ReceiptText,
  ShieldCheck,
  BookOpen,
  UserCircle,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

/**
 * Icon components (React function components) cannot be serialized across
 * the Server -> Client Component boundary, so the nav definitions —
 * including their icons — live here, in a client module, and are looked
 * up by a plain string key instead of being passed as props from a server
 * layout.
 */
export const NAV_ITEMS: Record<"admin" | "customer", NavItem[]> = {
  admin: [
    { label: "داشبورد", href: "/admin", icon: LayoutDashboard },
    { label: "محصولات", href: "/admin/products", icon: Package },
    { label: "لایسنس‌ها", href: "/admin/licenses", icon: KeyRound },
    { label: "سفارش‌ها", href: "/admin/orders", icon: ReceiptText },
    { label: "کاربران", href: "/admin/users", icon: Users },
    { label: "هوش مصنوعی", href: "/admin/settings/ai-provider", icon: Bot },
    { label: "پایگاه دانش", href: "/admin/knowledge-base", icon: BookOpen },
    { label: "پنل پیامک", href: "/admin/settings/sms-gateway", icon: MessageSquareText },
    { label: "گزارش رویدادها", href: "/admin/audit-log", icon: ScrollText },
    { label: "تنظیمات عمومی", href: "/admin/settings/general", icon: Settings },
  ],
  customer: [
    { label: "داشبورد", href: "/dashboard", icon: LayoutDashboard },
    { label: "لایسنس‌های من", href: "/dashboard/licenses", icon: KeyRound },
    { label: "سفارش‌های من", href: "/dashboard/orders", icon: ShoppingCart },
    { label: "امنیت حساب", href: "/dashboard/security", icon: ShieldCheck },
    { label: "پروفایل", href: "/dashboard/profile", icon: UserCircle },
  ],
};
