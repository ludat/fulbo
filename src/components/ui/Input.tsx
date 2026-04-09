import clsx from "clsx";

const base =
  "p-2 border border-border rounded-lg text-sm bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: InputProps) {
  return <input className={clsx(base, className)} {...props} />;
}

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({ className, ...props }: TextareaProps) {
  return <textarea className={clsx(base, className)} {...props} />;
}
