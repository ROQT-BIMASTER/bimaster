import { Link } from "react-router-dom";

interface Props {
  title: string;
  subtitle?: string;
  linkText?: string;
  linkTo?: string;
}

export function TradeSectionHeader({ title, subtitle, linkText = "Abrir todas", linkTo }: Props) {
  return (
    <div className="flex items-end justify-between px-1">
      <div>
        <h2 className="text-lg font-bold">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {linkTo && (
        <Link to={linkTo} className="text-sm font-medium text-[hsl(330,81%,60%)] hover:underline">
          {linkText}
        </Link>
      )}
    </div>
  );
}
