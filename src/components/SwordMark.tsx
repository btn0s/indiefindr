// The IndieFindr sword: a rounded tile in the text colour with the sword knocked out in the page colour, so it flips with the theme.
export function SwordMark({ className = "" }: { className?: string }) {
  return <svg className={className} width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
    <rect width="24" height="24" rx="6" fill="currentColor" />
    <path d="M12.7057 17.9728L14.0299 16.6487L10.7377 13.3567L7.4396 10.0586L6.11553 11.3827L7.33348 14.3331L4.85938 17.8014L5.52604 18.4681L6.19271 19.1347L9.66681 16.6487L12.7057 17.9728Z" fill="var(--background)" />
    <path d="M19 9.04753L13.6686 14.3789L12.1159 12.8262L15.5358 9.40755L14.5925 8.46419L11.1732 11.8835L9.62109 10.3314L14.9525 5H19V9.04753Z" fill="var(--background)" />
  </svg>;
}
