interface Props {
  label: string;
  value: React.ReactNode;
}

export function DataRow({ label, value }: Props) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums text-right">{value}</span>
    </div>
  );
}
