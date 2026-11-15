import type { StoryCategoryId } from "../../types/story";

export function CategoryEmblem({
  category,
  className,
}: {
  category: StoryCategoryId;
  className?: string;
}) {
  if (category === "book") {
    return (
      <svg
        className={className}
        viewBox="0 0 48 48"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="24" cy="24" r="20" strokeDasharray="2 3" opacity="0.55" />
        <path d="M12 16 L24 19 L36 16 V34 L24 37 L12 34 Z" />
        <path d="M24 19 V37" />
        <circle cx="24" cy="10" r="1.5" fill="currentColor" />
      </svg>
    );
  }
  if (category === "artifact") {
    return (
      <svg
        className={className}
        viewBox="0 0 48 48"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="24" cy="24" r="20" opacity="0.45" />
        <path d="M17 15 H31 L28 26 C27 30 21 30 20 26 Z" />
        <path d="M24 29 V36 M18 36 H30" />
        <path
          d="M24 8 L25.5 11.5 L29 13 L25.5 14.5 L24 18 L22.5 14.5 L19 13 L22.5 11.5 Z"
          fill="currentColor"
          stroke="none"
        />
      </svg>
    );
  }
  if (category === "weapon") {
    return (
      <svg
        className={className}
        viewBox="0 0 48 48"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="24" cy="24" r="20" strokeDasharray="3 3" opacity="0.5" />
        <path d="M24 9 L26.5 14 V30 L24 39 L21.5 30 V14 Z" />
        <path d="M16 20 Q24 23 32 20" />
      </svg>
    );
  }
  if (category === "attire") {
    return (
      <svg
        className={className}
        viewBox="0 0 48 48"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="24" cy="24" r="20" strokeDasharray="2 4" opacity="0.5" />
        <path d="M24 14 C18 14 12 18 10 25 C15 24 19 25 22 29 L24 34 L26 29 C29 25 33 24 38 25 C36 18 30 14 24 14 Z" />
        <circle cx="24" cy="11" r="1.4" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.35"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="24" cy="24" r="20" opacity="0.45" />
      <path d="M16 14 H30 V33 C30 35.5 28 37 26 37 H15 C13 37 12.5 35 14 33 V16 C14 14.8 14.8 14 16 14 Z" />
      <path d="M19 20 H26 M19 25 H25 M19 30 H23" />
      <circle cx="34" cy="14" r="1.4" fill="currentColor" />
    </svg>
  );
}
