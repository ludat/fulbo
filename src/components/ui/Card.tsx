import clsx from "clsx";
import { Link } from "react-router-dom";

type CardProps = React.ComponentProps<typeof Link>;

export function Card({ className, ...props }: CardProps) {
  return (
    <Link
      className={clsx(
        "bg-surface border-border text-text [&>p]:text-text-secondary block rounded-lg border p-4 no-underline transition-shadow hover:shadow-md motion-reduce:transition-none [&>h3]:mb-1 [&>p]:text-sm",
        className,
      )}
      {...props}
    />
  );
}
