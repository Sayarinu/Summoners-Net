import { X } from "lucide-react";
import type { ReactNode } from "react";
import {
  Dialog as AriaDialog,
  DialogTrigger,
  Heading,
  Modal,
  ModalOverlay,
  Popover as AriaPopover,
  Tooltip as AriaTooltip,
  TooltipTrigger,
} from "react-aria-components";

import { cx, Icon } from "./internal.js";
import { Button, IconButton } from "./primitives.js";

export interface TooltipProps {
  readonly children: ReactNode;
  readonly content: ReactNode;
  readonly delay?: number;
  readonly placement?: "bottom" | "left" | "right" | "top";
}

export function Tooltip({ children, content, delay = 400, placement = "top" }: TooltipProps) {
  return (
    <TooltipTrigger delay={delay}>
      {children}
      <AriaTooltip className="np-tooltip" offset={6} placement={placement}>
        {content}
      </AriaTooltip>
    </TooltipTrigger>
  );
}

export interface PopoverProps {
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  readonly placement?: "bottom" | "bottom end" | "bottom start" | "left" | "right" | "top";
  readonly title: string;
  readonly trigger: ReactNode;
}

export function Popover({ children, footer, placement = "bottom", title, trigger }: PopoverProps) {
  return (
    <DialogTrigger>
      {trigger}
      <AriaPopover className="np-popover np-popover-panel" offset={8} placement={placement}>
        <AriaDialog className="np-overlay-panel">
          {({ close }) => (
            <>
              <div className="np-overlay-panel__header">
                <Heading slot="title">{title}</Heading>
                <IconButton
                  icon={<Icon icon={X} size="small" />}
                  label="Close"
                  onPress={close}
                  size="compact"
                  variant="ghost"
                />
              </div>
              <div className="np-overlay-panel__body">{children}</div>
              {footer ? <div className="np-overlay-panel__footer">{footer}</div> : null}
            </>
          )}
        </AriaDialog>
      </AriaPopover>
    </DialogTrigger>
  );
}

interface OverlayControlProps {
  readonly defaultOpen?: boolean | undefined;
  readonly open?: boolean | undefined;
  readonly onOpenChange?: ((open: boolean) => void) | undefined;
}

export interface DialogProps extends OverlayControlProps {
  readonly children: ReactNode;
  readonly description?: string;
  readonly dismissible?: boolean;
  readonly footer?: ReactNode;
  readonly size?: "large" | "medium" | "small";
  readonly title: string;
  readonly trigger?: ReactNode | undefined;
}

export function Dialog({
  children,
  defaultOpen,
  description,
  dismissible = true,
  footer,
  onOpenChange,
  open,
  size = "medium",
  title,
  trigger,
}: DialogProps) {
  const control =
    open !== undefined ? { isOpen: open } : defaultOpen !== undefined ? { defaultOpen } : {};
  const overlayControl =
    trigger === undefined ? { ...control, ...(onOpenChange ? { onOpenChange } : {}) } : {};

  const overlay = (
    <ModalOverlay {...overlayControl} className="np-modal-overlay" isDismissable={dismissible}>
      <Modal className={cx("np-dialog", `np-dialog--${size}`)}>
        <AriaDialog className="np-dialog__content">
          {({ close }) => (
            <>
              <div className="np-dialog__header">
                <div>
                  <Heading slot="title">{title}</Heading>
                  {description ? <p>{description}</p> : null}
                </div>
                {dismissible ? (
                  <IconButton
                    icon={<Icon icon={X} size="small" />}
                    label="Close dialog"
                    onPress={close}
                    size="compact"
                    variant="ghost"
                  />
                ) : null}
              </div>
              <div className="np-dialog__body">{children}</div>
              {footer ? (
                <div className="np-dialog__footer">
                  <Button autoFocus onPress={close} variant="ghost">
                    Cancel
                  </Button>
                  {footer}
                </div>
              ) : null}
            </>
          )}
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );

  if (trigger === undefined) return overlay;

  return (
    <DialogTrigger {...control} {...(onOpenChange ? { onOpenChange } : {})}>
      {trigger}
      {overlay}
    </DialogTrigger>
  );
}

export interface DrawerProps extends OverlayControlProps {
  readonly children: ReactNode;
  readonly description?: string;
  readonly footer?: ReactNode;
  readonly side?: "left" | "right";
  readonly title: string;
  readonly trigger?: ReactNode | undefined;
}

export function Drawer({
  children,
  defaultOpen,
  description,
  footer,
  onOpenChange,
  open,
  side = "right",
  title,
  trigger,
}: DrawerProps) {
  const control =
    open !== undefined ? { isOpen: open } : defaultOpen !== undefined ? { defaultOpen } : {};
  const overlayControl =
    trigger === undefined ? { ...control, ...(onOpenChange ? { onOpenChange } : {}) } : {};

  const overlay = (
    <ModalOverlay {...overlayControl} className="np-modal-overlay np-drawer-overlay" isDismissable>
      <Modal className={cx("np-drawer", `np-drawer--${side}`)}>
        <AriaDialog className="np-drawer__content">
          {({ close }) => (
            <>
              <div className="np-drawer__header">
                <div>
                  <Heading slot="title">{title}</Heading>
                  {description ? <p>{description}</p> : null}
                </div>
                <IconButton
                  icon={<Icon icon={X} size="small" />}
                  label="Close drawer"
                  onPress={close}
                  size="compact"
                  variant="ghost"
                />
              </div>
              <div className="np-drawer__body">{children}</div>
              {footer ? <div className="np-drawer__footer">{footer}</div> : null}
            </>
          )}
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );

  if (trigger === undefined) return overlay;

  return (
    <DialogTrigger {...control} {...(onOpenChange ? { onOpenChange } : {})}>
      {trigger}
      {overlay}
    </DialogTrigger>
  );
}
