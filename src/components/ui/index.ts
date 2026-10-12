// =============================================================================
// UI Component Library — Barrel Export
// Import from "@/components/ui" instead of individual files
// =============================================================================

// ── Primitives ────────────────────────────────────────────────────────────────
export { Button } from "./Button"
export type { ButtonProps, ButtonVariant, ButtonSize } from "./Button"

export { Input } from "./Input"
export type { InputProps } from "./Input"

export { Textarea } from "./Textarea"
export type { TextareaProps } from "./Textarea"

export { Select } from "./Select"
export type { SelectProps, SelectOption } from "./Select"

export { Checkbox } from "./Checkbox"
export type { CheckboxProps } from "./Checkbox"

export { RadioGroup } from "./RadioGroup"
export type { RadioGroupProps, RadioOption } from "./RadioGroup"

export { FileInput } from "./FileInput"
export type { FileInputProps } from "./FileInput"

// ── Layout / Containers ───────────────────────────────────────────────────────
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  BentoCard,
} from "./Card"
export type { CardProps, CardVariant, CardAccent, BentoCardProps } from "./Card"

export { Modal, ConfirmModal } from "./Modal"
export type { ModalProps, ConfirmModalProps } from "./Modal"

export { Drawer } from "./Drawer"
export type { DrawerProps, DrawerSide } from "./Drawer"

// ── Motion / Structure ────────────────────────────────────────────────────────
export { Reveal } from "./Reveal"
export type { RevealProps } from "./Reveal"

export { SectionHeading } from "./SectionHeading"
export type { SectionHeadingProps } from "./SectionHeading"

// ── Navigation / Structure ────────────────────────────────────────────────────
export { Tabs, TabPanel } from "./Tabs"
export type { TabsProps, TabItem, TabsVariant } from "./Tabs"

export { Accordion } from "./Accordion"
export type { AccordionProps, AccordionItem } from "./Accordion"

export { Marquee } from "./Marquee"
export type { MarqueeProps } from "./Marquee"

export { Tooltip, Pagination, Breadcrumb } from "./Tooltip"
export type {
  TooltipProps,
  TooltipPlacement,
  PaginationProps,
  BreadcrumbProps,
  BreadcrumbItem,
} from "./Tooltip"

// ── Feedback ──────────────────────────────────────────────────────────────────
export {
  Badge,
  VerificationBadge,
  SecurityBadge,
  LiveBadge,
  OnlineBadge,
  EventTypeBadge,
  NewBadge,
} from "./Badge"
export type {
  BadgeProps,
  BadgeVariant,
  BadgeSize,
  VerificationBadgeProps,
} from "./Badge"

export {
  Alert,
  InlineAlert,
  RegistrationClosedAlert,
} from "./Alert"
export type { AlertProps, AlertVariant } from "./Alert"

export {
  Spinner,
  LoadingOverlay,
  LoadingDots,
  Skeleton,
  SkeletonLine,
  SkeletonCard,
  SkeletonTable,
  ProgressBar,
  SeatProgressBar,
} from "./Spinner"
export type {
  SpinnerProps,
  SpinnerSize,
  SpinnerVariant,
  SkeletonProps,
  ProgressBarProps,
  ProgressVariant,
} from "./Spinner"

// ── Registration Wizard ───────────────────────────────────────────────────────
export { StepIndicator, MiniStepBar } from "./StepIndicator"
export type {
  StepIndicatorProps,
  MiniStepBarProps,
  Step,
  StepStatus,
} from "./StepIndicator"

// ── Event-specific Widgets ────────────────────────────────────────────────────
export {
  SeatCounter,
  CountdownTimer,
  StatCard,
  TerminalWindow,
  TypewriterText,
} from "./EventWidgets"
export type {
  SeatCounterProps,
  CountdownTimerProps,
  StatCardProps,
  TerminalWindowProps,
  TypewriterTextProps,
} from "./EventWidgets"
