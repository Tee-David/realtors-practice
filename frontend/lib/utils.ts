import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(price?: number | null): string {
  if (price == null) return "N/A";
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat("en-NG").format(num);
}

/**
 * Format price as an abbreviated label for map markers.
 * e.g. 5000000 -> "₦5M", 880000 -> "₦880K", 200000 (rent) -> "₦200K/mo"
 */
export function formatPriceShort(price?: number | null, listingType?: string): string {
  if (price == null) return "N/A";
  const isRent = listingType === "RENT" || listingType === "SHORTLET";
  const suffix = isRent ? "/mo" : "";
  if (price >= 1_000_000_000) return `₦${(price / 1_000_000_000).toFixed(price % 1_000_000_000 === 0 ? 0 : 1)}B${suffix}`;
  if (price >= 1_000_000) return `₦${(price / 1_000_000).toFixed(price % 1_000_000 === 0 ? 0 : 1)}M${suffix}`;
  if (price >= 1_000) return `₦${(price / 1_000).toFixed(0)}K${suffix}`;
  return `₦${price}${suffix}`;
}

/** Pluralize: "1 property" vs "2 properties" */
export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural || singular + "s");
}