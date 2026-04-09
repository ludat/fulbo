import clsx from "clsx";

const variants = {
  admin: "bg-green-50 text-primary",
  member: "bg-blue-50 text-blue-800",
  danger: "bg-red-50 text-danger",
};

type BadgeProps = {
  variant: keyof typeof variants;
  children: React.ReactNode;
  className?: string;
};

export function Badge({ variant, children, className }: BadgeProps) {
  return (
    <span
      className={clsx(
        "rounded-full px-2 py-0.5 text-xs font-semibold uppercase",
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
