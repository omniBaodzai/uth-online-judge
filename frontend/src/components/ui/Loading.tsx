import { useLayoutEffect, useRef, type HTMLAttributes } from 'react'
import { createPortal } from 'react-dom'
import styles from './Loading.module.css'

export type LoadingSpinnerSize = 'small' | 'medium' | 'large' | 'extraLarge'

type LoadingSpinnerProps = {
  size?: LoadingSpinnerSize
  label?: string
  className?: string
}

export function LoadingSpinner({ size = 'medium', label, className }: LoadingSpinnerProps) {
  return (
    <span
      className={`${styles.spinner} ${styles[`size${size[0].toUpperCase()}${size.slice(1)}`]} ${className ?? ''}`}
      data-size={size}
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <span className={styles.outerRing} />
      <span className={styles.innerRing} />
      <span className={styles.centerDot} />
    </span>
  )
}

type SectionLoaderProps = {
  label: string
  size?: LoadingSpinnerSize
  className?: string
}

export function SectionLoader({ label, size = 'medium', className }: SectionLoaderProps) {
  return (
    <div
      className={`${styles.sectionLoader} ${className ?? ''}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <LoadingSpinner size={size} />
      <span>{label}</span>
    </div>
  )
}

type FullscreenLoaderProps = {
  label: string
}

export function FullscreenLoader({ label }: FullscreenLoaderProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const statusRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const overlay = overlayRef.current
    if (!overlay) return

    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const previousBodyOverflow = document.body.style.overflow
    const previousDocumentOverflow = document.documentElement.style.overflow
    const backgroundStates = Array.from(document.body.children)
      .filter((element): element is HTMLElement => (
        element instanceof HTMLElement && element !== overlay && element.tagName !== 'SCRIPT'
      ))
      .map((element) => ({
        element,
        inert: element.inert,
        ariaHidden: element.getAttribute('aria-hidden'),
      }))

    for (const { element } of backgroundStates) {
      element.inert = true
      element.setAttribute('aria-hidden', 'true')
    }
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    statusRef.current?.focus({ preventScroll: true })

    return () => {
      for (const { element, inert, ariaHidden } of backgroundStates) {
        element.inert = inert
        if (ariaHidden === null) element.removeAttribute('aria-hidden')
        else element.setAttribute('aria-hidden', ariaHidden)
      }
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousDocumentOverflow
      if (previousFocus && previousFocus !== document.body && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true })
      }
    }
  }, [])

  return createPortal(
    <div ref={overlayRef} className={styles.fullscreen} data-loading-screen>
      <div
        ref={statusRef}
        className={styles.fullscreenStatus}
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label={label}
        tabIndex={-1}
      >
        <LoadingSpinner size="extraLarge" className={styles.fullscreenSpinner} />
      </div>
    </div>,
    document.body,
  )
}

type ButtonLoaderProps = {
  className?: string
}

export function ButtonLoader({ className }: ButtonLoaderProps) {
  return (
    <span className={`${styles.buttonLoader} ${className ?? ''}`} aria-hidden="true">
      <LoadingSpinner size="small" />
    </span>
  )
}

type LoadingSkeletonProps = HTMLAttributes<HTMLDivElement>

export function LoadingSkeleton({ className, ...props }: LoadingSkeletonProps) {
  return (
    <div
      {...props}
      className={`${styles.skeleton} ${className ?? ''}`}
      aria-hidden="true"
    />
  )
}
