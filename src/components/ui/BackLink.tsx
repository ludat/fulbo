import clsx from "clsx";
import { Link } from "react-router-dom";

type BackLinkProps = React.ComponentProps<typeof Link>;

export function BackLink({ className, ...props }: BackLinkProps) {
  return (
    <Link
      className={clsx(
        "text-primary mb-4 inline-block text-sm no-underline hover:underline",
        className,
      )}
      {...props}
    />
  );
}
