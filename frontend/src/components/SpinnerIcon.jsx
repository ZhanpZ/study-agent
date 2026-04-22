export default function SpinnerIcon({ className = "h-4 w-4" }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M21 12a9 9 0 11-6.219-8.56" />
    </svg>
  );
}
