import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function ChatIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H9l-4 3.5V16H5.5A1.5 1.5 0 0 1 4 14.5Z" />
      <path d="M8.5 9.5h7M8.5 12.5h4" />
    </Icon>
  );
}

export function KnowledgeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 4.5h9a2 2 0 0 1 2 2V19a1 1 0 0 1-1 1H6.5A1.5 1.5 0 0 1 5 18.5Z" />
      <path d="M9 4.5V20" />
      <path d="M18.5 7.5 20 8v11.2a.8.8 0 0 1-1.1.75L16 18.8" />
    </Icon>
  );
}

export function RetrievalIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="11" cy="11" r="6" />
      <path d="M11 8.5v5M8.5 11h5" />
      <path d="m20 20-3.6-3.6" />
    </Icon>
  );
}

export function EvaluationsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3.5 5 6v5.4c0 4 2.9 6.9 7 9.1 4.1-2.2 7-5.1 7-9.1V6Z" />
      <path d="m9.2 11.6 2 2 3.6-3.8" />
    </Icon>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 7.5h9M17 7.5h2" />
      <circle cx="15.5" cy="7.5" r="2" />
      <path d="M5 16.5h2M10 16.5h9" />
      <circle cx="8.5" cy="16.5" r="2" />
    </Icon>
  );
}

export function SendIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 19V6" />
      <path d="m6.5 11.5 5.5-5.5 5.5 5.5" />
    </Icon>
  );
}

export function SourceIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7 3.5h6.5L18 8v11a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V5A1.5 1.5 0 0 1 7 3.5Z" />
      <path d="M13 3.5V8h4.5" />
      <path d="M9 12.5h6M9 15.5h4" />
    </Icon>
  );
}

export function QuoteIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9.5 6H6a2 2 0 0 0-2 2v3.5a2 2 0 0 0 2 2h1.5V16a2 2 0 0 1-2 2" />
      <path d="M20 6h-3.5a2 2 0 0 0-2 2v3.5a2 2 0 0 0 2 2H18V16a2 2 0 0 1-2 2" />
    </Icon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m5 12.5 4 4 10-10" />
    </Icon>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Icon>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Icon>
  );
}

export function LayersIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m12 3 8 4.5-8 4.5-8-4.5Z" />
      <path d="m4 12 8 4.5 8-4.5" />
    </Icon>
  );
}
