import { Check, Clock, X, AlertTriangle } from "lucide-react";

const MAP = {
  completed: { cls: "bg-emerald/15 text-emerald border-emerald/30", Icon: Check },
  pending:   { cls: "bg-white/5 text-muted-foreground border-white/10", Icon: Clock },
  late:      { cls: "bg-orange/15 text-orange border-orange/30", Icon: AlertTriangle },
  missed:    { cls: "bg-destructive/15 text-destructive border-destructive/30", Icon: X },
  skipped:   { cls: "bg-purple/15 text-purple border-purple/30", Icon: X },
} as const;

export function StatusDot({ status, size = 28 }: { status: keyof typeof MAP; size?: number }) {
  const { cls, Icon } = MAP[status];
  return (
    <span className={`grid place-items-center rounded-full border ${cls}`} style={{ width: size, height: size }}>
      <Icon className="size-3.5" strokeWidth={2.5} />
    </span>
  );
}