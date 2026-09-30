import { useMemo } from "react";

function initials(nome: string) {
  const parts = (nome || "").trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}

export function AlunoAvatar({
  nome,
  fotoUrl,
  className = "",
  textClassName = "",
}: {
  nome: string;
  fotoUrl?: string | null;
  className?: string;
  textClassName?: string;
}) {
  const ini = useMemo(() => initials(nome), [nome]);
  if (fotoUrl) {
    return (
      <div
        className={`rounded-full overflow-hidden bg-blue-50 ring-1 ring-blue-100 shrink-0 ${className}`}
      >
        <img src={fotoUrl} alt={nome} className="h-full w-full object-cover" />
      </div>
    );
  }
  return (
    <div
      className={`rounded-full bg-gradient-to-br from-blue-50 to-blue-100 ring-1 ring-blue-100 text-blue-700 font-semibold flex items-center justify-center shrink-0 ${className} ${textClassName}`}
    >
      {ini}
    </div>
  );
}
