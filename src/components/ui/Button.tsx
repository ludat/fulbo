import clsx from "clsx";
import { Link } from "react-router-dom";

const base =
  "inline-flex items-center rounded-lg font-medium cursor-pointer transition-colors motion-reduce:transition-none disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const sizes = {
  default: "px-4 py-2 text-sm",
  sm: "px-2 py-1 text-xs",
};

const variants = {
  primary:
    "border border-transparent bg-primary text-white hover:bg-primary-hover",
  secondary: "border border-border bg-surface text-text hover:bg-gray-200",
  danger: "border border-transparent bg-danger text-white",
  active: "border border-primary bg-primary text-white",
};

export type ButtonVariant = keyof typeof variants;
export type ButtonSize = keyof typeof sizes;

function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "default",
) {
  return clsx(base, sizes[size], variants[variant]);
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({
  variant = "primary",
  size = "default",
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={clsx(buttonClasses(variant, size), className)}
      {...props}
    />
  );
}

type LinkButtonProps = React.ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function LinkButton({
  variant = "primary",
  size = "default",
  className,
  ...props
}: LinkButtonProps) {
  return (
    <Link
      className={clsx(buttonClasses(variant, size), "no-underline", className)}
      {...props}
    />
  );
}
