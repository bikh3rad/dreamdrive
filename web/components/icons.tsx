// آیکون‌های SVG درون‌خطی — بدون وابستگی خارجی.

type P = { className?: string };
const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
};

export function Logo({ className }: P) {
  return (
    <svg className={className} viewBox="0 0 40 40" aria-hidden>
      <circle cx="20" cy="20" r="20" fill="#1E2A47" />
      <circle cx="20" cy="20" r="12" fill="none" stroke="#F0A828" strokeWidth="2.5" />
      <circle cx="20" cy="20" r="6" fill="none" stroke="#F0A828" strokeWidth="2.5" />
      <circle cx="20" cy="20" r="2.5" fill="#F0A828" />
    </svg>
  );
}

export const IconTicket = ({ className }: P) => (
  <svg {...base} className={className} aria-hidden>
    <path d="M3 9V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4Z" />
    <path d="M13 5v2M13 11v2M13 17v2" strokeDasharray="0 4" />
  </svg>
);

export const IconGift = ({ className }: P) => (
  <svg {...base} className={className} aria-hidden>
    <path d="M20 12v9H4v-9M2 8h20v4H2zM12 8v13M12 8S10 3 7.5 3a2.5 2.5 0 0 0 0 5M12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5" />
  </svg>
);

export const IconSettings = ({ className }: P) => (
  <svg {...base} className={className} aria-hidden>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
  </svg>
);

export const IconMenu = ({ className }: P) => (
  <svg {...base} className={className} aria-hidden>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

export const IconTarget = ({ className }: P) => (
  <svg {...base} className={className} aria-hidden>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="4.5" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
  </svg>
);

export const IconTrophy = ({ className }: P) => (
  <svg {...base} className={className} aria-hidden>
    <path d="M6 4h12v5a6 6 0 0 1-12 0z M6 6H4a2 2 0 0 0 0 4h2M18 6h2a2 2 0 0 1 0 4h-2M9 20h6M12 15v5" />
  </svg>
);

export const IconShield = ({ className }: P) => (
  <svg {...base} className={className} aria-hidden>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

export const IconScale = ({ className }: P) => (
  <svg {...base} className={className} aria-hidden>
    <path d="M12 3v18M8 21h8M3 7h18M6 7l-3 7h6zM18 7l-3 7h6z" />
  </svg>
);

export const IconGlobe = ({ className }: P) => (
  <svg {...base} className={className} aria-hidden>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z" />
  </svg>
);

export const IconUsers = ({ className }: P) => (
  <svg {...base} className={className} aria-hidden>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

export const IconChart = ({ className }: P) => (
  <svg {...base} className={className} aria-hidden>
    <path d="M3 3v18h18M7 15l4-4 3 3 5-6" />
  </svg>
);

export const IconCalendar = ({ className }: P) => (
  <svg {...base} className={className} aria-hidden>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M16 3v4M8 3v4M3 11h18" />
  </svg>
);

export const IconPin = ({ className }: P) => (
  <svg {...base} className={className} aria-hidden>
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

export const IconWallet = ({ className }: P) => (
  <svg {...base} className={className} aria-hidden>
    <path d="M3 7a2 2 0 0 1 2-2h13v4M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H5a2 2 0 0 1-2-2z" />
    <circle cx="17" cy="14" r="1.2" fill="currentColor" stroke="none" />
  </svg>
);

export const IconInfo = ({ className }: P) => (
  <svg {...base} className={className} aria-hidden>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 16v-4M12 8h.01" />
  </svg>
);

export const IconShare = ({ className }: P) => (
  <svg {...base} className={className} aria-hidden>
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
  </svg>
);

export const IconBox = ({ className }: P) => (
  <svg {...base} className={className} aria-hidden>
    <path d="M21 8v8a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.73l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8z" />
    <path d="m3.3 7 8.7 5 8.7-5M12 22V12" />
  </svg>
);

export const IconFile = ({ className }: P) => (
  <svg {...base} className={className} aria-hidden>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6M9 13h6M9 17h6" />
  </svg>
);

export const IconLogout = ({ className }: P) => (
  <svg {...base} className={className} aria-hidden>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
  </svg>
);

export const IconCheck = ({ className }: P) => (
  <svg {...base} className={className} aria-hidden>
    <path d="m20 6-11 11-5-5" />
  </svg>
);

export const IconX = ({ className }: P) => (
  <svg {...base} className={className} aria-hidden>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

export const IconLock = ({ className }: P) => (
  <svg {...base} className={className} aria-hidden>
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);

export const IconMail = ({ className }: P) => (
  <svg {...base} className={className} aria-hidden>
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m2 7 10 6 10-6" />
  </svg>
);
