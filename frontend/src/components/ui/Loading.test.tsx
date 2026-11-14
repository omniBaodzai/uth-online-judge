// @vitest-environment happy-dom

import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ButtonLoader, FullscreenLoader, LoadingSkeleton, LoadingSpinner, SectionLoader } from './Loading'

let root: Root
let container: HTMLDivElement

beforeEach(() => {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  container.id = 'root'
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

async function render(element: ReactNode) {
  await act(async () => root.render(element))
}

describe('shared loading components', () => {
  it.each(['small', 'medium', 'large', 'extraLarge'] as const)('renders the %s spinner size', async (size) => {
    await render(<LoadingSpinner size={size} />)

    expect(container.querySelector(`[data-size="${size}"]`)).not.toBeNull()
  })

  it('exposes an accessible status label for a standalone spinner', async () => {
    await render(<LoadingSpinner label="Loading profile" />)

    expect(container.querySelector('[role="status"]')?.getAttribute('aria-label')).toBe('Loading profile')
    expect(container.querySelector('[role="status"]')?.hasAttribute('aria-hidden')).toBe(false)
  })

  it('keeps the decorative spinner hidden inside a labelled section status', async () => {
    await render(<SectionLoader label="Loading results" />)

    expect(container.querySelector('[role="status"]')?.textContent).toContain('Loading results')
    expect(container.querySelector('[role="status"]')?.getAttribute('aria-busy')).toBe('true')
    expect(container.querySelector('[data-size="medium"]')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('renders a decorative small spinner for button composition', async () => {
    await render(<ButtonLoader />)

    expect(container.querySelector('[data-size="small"]')).not.toBeNull()
    expect(container.querySelector('[role="status"]')).toBeNull()
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull()
  })

  it('renders skeletons as decorative content', async () => {
    await render(<LoadingSkeleton data-testid="skeleton" />)

    expect(container.querySelector('[data-testid="skeleton"]')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('covers the app, announces loading, and restores page state when removed', async () => {
    function AppContent({ loading }: { loading: boolean }) {
      return (
        <>
          <button type="button">Background action</button>
          {loading && <FullscreenLoader label="Loading route" />}
        </>
      )
    }

    await render(<AppContent loading={false} />)
    const backgroundButton = container.querySelector('button')!
    backgroundButton.focus()
    const previousBodyOverflow = document.body.style.overflow
    const previousDocumentOverflow = document.documentElement.style.overflow

    await render(<AppContent loading />)

    const overlay = document.body.querySelector('[data-loading-screen]')
    const status = overlay?.querySelector('[role="status"]')
    expect(overlay).not.toBeNull()
    expect(status?.getAttribute('aria-label')).toBe('Loading route')
    expect(status?.getAttribute('aria-live')).toBe('polite')
    expect(status?.getAttribute('aria-busy')).toBe('true')
    expect(container.inert).toBe(true)
    expect(container.getAttribute('aria-hidden')).toBe('true')
    expect(document.activeElement).toBe(status)
    expect(document.body.style.overflow).toBe('hidden')
    expect(document.documentElement.style.overflow).toBe('hidden')

    await render(<AppContent loading={false} />)

    expect(document.body.querySelector('[data-loading-screen]')).toBeNull()
    expect(container.inert).toBe(false)
    expect(container.hasAttribute('aria-hidden')).toBe(false)
    expect(document.body.style.overflow).toBe(previousBodyOverflow)
    expect(document.documentElement.style.overflow).toBe(previousDocumentOverflow)
    expect(document.activeElement).toBe(backgroundButton)
  })
})
