import React from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

export interface MuiChipProps extends React.HTMLAttributes<HTMLDivElement> {
    label: React.ReactNode;
    avatar?: React.ReactNode;
    onDelete?: () => void;
    variant?: "filled" | "outlined";
    color?: "default" | "primary" | "secondary" | "success" | "error" | "info" | "warning";
    size?: "small" | "medium";
    onClick?: () => void;
    disabled?: boolean;
}

export function MuiChip({
    label,
    avatar,
    onDelete,
    variant = "filled",
    color = "default",
    size = "medium",
    onClick,
    disabled = false,
    className,
    ...props
}: MuiChipProps) {
    // Base styles matching MUI Chip
    const baseStyles = "inline-flex items-center justify-center max-w-full whitespace-nowrap rounded-full transition-colors font-medium border box-border select-none align-middle";

    // Size styles
    const sizeStyles = {
        small: "h-6 text-[0.8125rem] px-2",
        medium: "h-8 text-[0.875rem] px-3",
    };

    // Color & Variant styles
    const colorStyles = {
        default: {
            filled: "bg-black/10 text-gray-800 border-transparent hover:bg-black/20 focus:bg-black/20 dark:bg-white/10 dark:text-gray-100 dark:hover:bg-white/20",
            outlined: "bg-transparent text-gray-800 border-black/20 hover:bg-black/5 dark:text-gray-100 dark:border-white/20 dark:hover:bg-white/5",
        },
        primary: { // Assuming Blue/Indigo
            filled: "bg-blue-600 text-white border-transparent hover:bg-blue-700",
            outlined: "bg-transparent text-blue-600 border-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-400 dark:hover:bg-blue-900/20",
        },
        secondary: { // Assuming Purple
            filled: "bg-purple-600 text-white border-transparent hover:bg-purple-700",
            outlined: "bg-transparent text-purple-600 border-purple-600 hover:bg-purple-50 dark:text-purple-400 dark:border-purple-400 dark:hover:bg-purple-900/20",
        },
        success: {
            filled: "bg-green-600 text-white border-transparent hover:bg-green-700",
            outlined: "bg-transparent text-green-600 border-green-600 hover:bg-green-50 dark:text-green-400 dark:border-green-400 dark:hover:bg-green-900/20",
        },
        error: {
            filled: "bg-red-600 text-white border-transparent hover:bg-red-700",
            outlined: "bg-transparent text-red-600 border-red-600 hover:bg-red-50 dark:text-red-400 dark:border-red-400 dark:hover:bg-red-900/20",
        },
        info: {
            filled: "bg-cyan-600 text-white border-transparent hover:bg-cyan-700",
            outlined: "bg-transparent text-cyan-600 border-cyan-600 hover:bg-cyan-50 dark:text-cyan-400 dark:border-cyan-400 dark:hover:bg-cyan-900/20",
        },
        warning: {
            filled: "bg-amber-500 text-white border-transparent hover:bg-amber-600",
            outlined: "bg-transparent text-amber-600 border-amber-500 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-400 dark:hover:bg-amber-900/20",
        },
    };

    const interactiveStyles = onClick && !disabled ? "cursor-pointer active:shadow-inner" : "cursor-default";
    const disabledStyles = disabled ? "opacity-50 pointer-events-none grayscale" : "";

    // Helper to adjust padding if avatar is present
    const paddingAdjustment = avatar
        ? size === "small" ? "pl-1" : "pl-1"
        : "";

    // Delete icon sizing
    const deleteIconSize = size === "small" ? 14 : 18;
    const deleteIconClass = "ml-1.5 -mr-1 rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer text-inherit opacity-70 hover:opacity-100";

    return (
        <div
            className={cn(
                baseStyles,
                sizeStyles[size],
                colorStyles[color][variant],
                interactiveStyles,
                disabledStyles,
                paddingAdjustment,
                className
            )}
            onClick={onClick}
            {...props}
        >
            {avatar && (
                <span className={cn(
                    "flex items-center justify-center rounded-full overflow-hidden -ml-1 mr-1.5",
                    size === "small" ? "w-4 h-4 text-[0.625rem]" : "w-6 h-6 text-xs",
                    // If avatar is just text/element, give it background if not image
                    "bg-gray-400 text-white"
                )}>
                    {avatar}
                </span>
            )}
            <span className="truncate">{label}</span>
            {onDelete && (
                <X
                    size={deleteIconSize}
                    className={deleteIconClass}
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                    }}
                />
            )}
        </div>
    );
}

export interface MuiAvatarProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    children?: React.ReactNode;
}

export function MuiAvatar({ children, className, src, alt, ...props }: MuiAvatarProps) {
    const baseStyles = "relative flex items-center justify-center shrink-0 overflow-hidden rounded-full select-none bg-gray-400 text-white w-10 h-10 text-xl font-normal";

    if (src) {
        return (
            <img
                className={cn(baseStyles, "object-cover", className)}
                src={src}
                alt={alt}
                {...props}
            />
        );
    }

    return (
        <div className={cn(baseStyles, className)} {...props}>
            {children}
        </div>
    );
}
