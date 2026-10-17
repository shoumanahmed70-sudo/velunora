/**
 * أيقونات SVG مضمّنة (بدون صور خارجية) — تُستخدم في واجهة المتجر.
 */
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 20, ...props }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    ...props,
  };
}

export function MenuIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" />
    </svg>
  );
}

export function CartIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L21 8H6" />
      <circle cx="9.5" cy="20" r="1.4" />
      <circle cx="17.5" cy="20" r="1.4" />
    </svg>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20a8 8 0 0 1 16 0" />
    </svg>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m15 6-6 6 6 6" />
    </svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function MinusIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 12h14" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m5 13 4 4L19 7" />
    </svg>
  );
}

export function StarIcon({ filled = false, ...props }: IconProps & { filled?: boolean }) {
  return (
    <svg
      {...base(props)}
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
    >
      <path d="M12 3.6l2.5 5.1 5.6.8-4 3.9.9 5.6-5-2.6-5 2.6.9-5.6-4-3.9 5.6-.8z" />
    </svg>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 4 2.5 20h19z" />
      <path d="M12 10v4M12 17.5h.01" />
    </svg>
  );
}

export function WhatsappIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      {...props}
    >
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.08-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.47s1.06 2.87 1.21 3.07c.15.2 2.09 3.2 5.07 4.48.71.31 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35z" />
      <path d="M12.04 2C6.6 2 2.18 6.42 2.18 11.86c0 1.74.46 3.44 1.32 4.94L2 22l5.35-1.4a9.84 9.84 0 0 0 4.69 1.2h.01c5.43 0 9.85-4.42 9.85-9.86 0-2.63-1.03-5.11-2.89-6.97A9.78 9.78 0 0 0 12.04 2zm0 1.8c2.15 0 4.17.84 5.69 2.36a8.02 8.02 0 0 1 2.36 5.7c0 4.44-3.61 8.05-8.06 8.05-1.44 0-2.86-.39-4.1-1.12l-.29-.17-3.05.8.82-2.98-.19-.31a7.94 7.94 0 0 1-1.22-4.26c0-4.44 3.61-8.05 8.04-8.05z" />
    </svg>
  );
}

export function InstagramIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <path d="M17.2 6.8h.01" />
    </svg>
  );
}

export function TiktokIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M16.5 3c.4 2.1 1.7 3.5 3.9 3.7v2.6c-1.3.1-2.6-.3-3.8-1v6.1c0 4.5-4.9 6.3-7.7 4-2-1.6-2.2-4.7-.5-6.6 1-1.1 2.4-1.6 3.9-1.4v2.7c-.5-.2-1.1-.2-1.6 0-1 .4-1.4 1.6-1 2.6.4 1 1.6 1.4 2.6 1 .7-.3 1-.9 1-1.7V3h3.2z" />
    </svg>
  );
}

export function SnapchatIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3c2.6 0 4.2 1.9 4.2 4.5 0 1-.1 1.9-.1 2.5.6.4 1.4.3 1.9.1.6.8-.6 1.7-1.7 2.1.3.9 1.5 1.9 2.9 2.2-.2.7-1.6 1.2-2.6 1.3-.2.7-.4 1.3-1.3 1.1-.7-.2-1.5-.4-2.4-.1-.8.3-1.1 1-2.8 1-1.7 0-2-.7-2.8-1-.9-.3-1.7-.1-2.4.1-.9.2-1.1-.4-1.3-1.1-1-.1-2.4-.6-2.6-1.3 1.4-.3 2.6-1.3 2.9-2.2-1.1-.4-2.3-1.3-1.7-2.1.5.2 1.3.3 1.9-.1 0-.6-.1-1.5-.1-2.5C7.8 4.9 9.4 3 12 3z" />
    </svg>
  );
}

export function FacebookIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M13.5 21v-7h2.3l.4-2.8h-2.7V9.4c0-.8.3-1.4 1.5-1.4h1.3V5.5c-.6-.1-1.4-.2-2.3-.2-2.3 0-3.8 1.4-3.8 3.9v2H8v2.8h2.2V21h3.3z" />
    </svg>
  );
}

export function XIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M17.5 3h2.9l-6.3 7.2L21.7 21h-5.8l-4.1-5.4L7 21H4.1l6.7-7.6L4 3h5.9l3.7 4.9L17.5 3zm-1 16.2h1.6L8.1 4.7H6.4l10.1 14.5z" />
    </svg>
  );
}
