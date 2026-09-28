"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      richColors
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
          // Map sonner's richColors palette onto the app's own AA-tuned status
          // chip tokens (index.css) instead of sonner's default red/green/
          // yellow, so a toast matches StatusBadge/InitiativeStatusBadge.
          "--success-bg": "var(--chip-success-bg)",
          "--success-text": "var(--chip-success-fg)",
          "--success-border": "var(--chip-success-fg)",
          "--error-bg": "var(--chip-rejected-bg)",
          "--error-text": "var(--chip-rejected-fg)",
          "--error-border": "var(--chip-rejected-fg)",
          "--warning-bg": "var(--chip-warning-bg)",
          "--warning-text": "var(--chip-warning-fg)",
          "--warning-border": "var(--chip-warning-fg)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
