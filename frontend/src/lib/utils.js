import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** shadcn/ui class merge utility */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
