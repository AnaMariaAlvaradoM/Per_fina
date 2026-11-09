// Íconos de línea compartidos. Heredan el color del texto (currentColor).

const Icon = ({ size = 22, children, ...rest }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" {...rest}
  >
    {children}
  </svg>
);

export const IconHome = (p) => (
  <Icon {...p}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
  </Icon>
);

export const IconSwap = (p) => (
  <Icon {...p}>
    <path d="M7 20V4" />
    <path d="m3 8 4-4 4 4" />
    <path d="M17 4v16" />
    <path d="m13 16 4 4 4-4" />
  </Icon>
);

export const IconWallet = (p) => (
  <Icon {...p}>
    <path d="M19 8V6a1 1 0 0 0-1-1H5.5a2.5 2.5 0 0 0 0 5" />
    <path d="M3 7.5V17A2.5 2.5 0 0 0 5.5 19.5H19a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2H5.5" />
    <circle cx="16.5" cy="13.75" r="1.1" fill="currentColor" stroke="none" />
  </Icon>
);

export const IconCalendarCheck = (p) => (
  <Icon {...p}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
    <path d="M8 3v4M16 3v4M3.5 10h17" />
    <path d="m9 15 2 2 4-4" />
  </Icon>
);

export const IconCheck = (p) => (
  <Icon strokeWidth="2.6" {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Icon>
);

export const IconDots = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="5" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="12" cy="19" r="1.4" fill="currentColor" stroke="none" />
  </Icon>
);

export const IconChevronLeft = (p) => (
  <Icon {...p}><path d="m15 5-7 7 7 7" /></Icon>
);

export const IconChevronRight = (p) => (
  <Icon {...p}><path d="m9 5 7 7-7 7" /></Icon>
);

export const IconPencil = (p) => (
  <Icon {...p}>
    <path d="M4 20l1-4.5L16.5 4a2.1 2.1 0 0 1 3 3L8 18.5 4 20Z" />
    <path d="m14.5 6 3 3" />
  </Icon>
);

export const IconTrash = (p) => (
  <Icon {...p}>
    <path d="M4 7h16" />
    <path d="M9 7V4.5h6V7" />
    <path d="M6.5 7l.8 12a1.5 1.5 0 0 0 1.5 1.5h6.4a1.5 1.5 0 0 0 1.5-1.5l.8-12" />
    <path d="M10 11v6M14 11v6" />
  </Icon>
);
