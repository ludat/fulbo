export function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex items-center">
      <span className="ml-1 inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-current text-[10px] leading-none opacity-60 transition-opacity group-hover:opacity-100">
        ?
      </span>
      <span className="pointer-events-none absolute right-0 bottom-full z-50 mb-2 translate-x-1/2 opacity-0 transition-opacity group-hover:opacity-100">
        <span className="bg-surface border-border text-text block w-56 rounded-lg border p-2 text-xs font-normal shadow-lg">
          {text}
        </span>
        <span className="bg-surface border-border absolute right-1/2 -bottom-[5px] h-2.5 w-2.5 -translate-x-1/2 rotate-45 border-r border-b" />
      </span>
    </span>
  );
}
