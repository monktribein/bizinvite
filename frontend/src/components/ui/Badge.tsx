import React from "react";
import { cn } from "@/lib/utils/cn";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "danger" | "info" | "outline" | "vip";
  size?: "sm" | "md";
}

export function Badge({ className, variant = "default", size = "sm", children, ...props }: BadgeProps) {
  const baseStyles = "inline-flex items-center font-medium rounded-full border";

  const variantStyles = {
    default: "bg-slate-100 text-slate-700 border-slate-200",
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    danger: "bg-rose-50 text-rose-700 border-rose-200",
    info: "bg-sky-50 text-sky-700 border-sky-200",
    outline: "border-slate-300 text-slate-700 bg-white",
    vip: "bg-amber-100 text-amber-900 border-amber-300 font-semibold shadow-xs",
  };

  const sizeStyles = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-2.5 py-1 text-xs tracking-wide",
  };

  return (
    <span className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)} {...props}>
      {children}
    </span>
  );
}
