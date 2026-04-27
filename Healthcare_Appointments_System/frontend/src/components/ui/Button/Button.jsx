import React from "react";
import "./Button.css";

// Global utility classes (defined in index.css) — kept as-is
const variants = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  ghost: "btn-ghost",
  danger: "btn-danger",
};

// Size classes now come from Button.css
const sizes = {
  sm: "btn--sm",
  md: "",
  lg: "btn--lg",
};

export default function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  className = "",
  ...props
}) {
  return (
    <button
      className={`btn ${variants[variant]} ${size !== "md" ? sizes[size] : ""} ${className}`.trim()}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <span className="btn__spinner" />}
      {children}
    </button>
  );
}
