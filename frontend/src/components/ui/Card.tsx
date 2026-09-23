import React from "react";
import { cn } from "@/lib/utils/cn";

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  title,
  subtitle,
  action,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { title?: React.ReactNode; subtitle?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className={cn("px-6 py-4 border-b border-slate-100 flex items-center justify-between", className)} {...props}>
      {title || subtitle ? (
        <div>
          {title && <h3 className="text-sm font-semibold text-slate-900">{title}</h3>}
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      ) : (
        children
      )}
      {action && <div>{action}</div>}
    </div>
  );
}

export function CardContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("p-6", className)} {...props}>
      {children}
    </div>
  );
}
