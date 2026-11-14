// @vitest-environment happy-dom

import { act, lazy, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '../../i18n'
import RouteLoadBoundary from './RouteLoadBoundary'

let root: Root
let container: HTMLDivElement

beforeEach(() => {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.restoreAllMocks()
})

describe('RouteLoadBoundary', () => {
  it('announces loading and renders the lazy route when it resolves', async () => {
    let resolveRoute: ((module: { default: () => ReactNode }) => void) | undefined
    const LazyRoute = lazy(
      () => new Promise<{ default: () => ReactNode }>((resolve) => {
        resolveRoute = resolve
      }),
    )

    await act(async () => {
      root.render(
        <MemoryRouter>
          <RouteLoadBoundary>
            <LazyRoute />
          </RouteLoadBoundary>
        </MemoryRouter>,
      )
    })

    const status = document.body.querySelector('[data-loading-screen] [role="status"]')
    expect(status?.getAttribute('aria-label')).toBe('Đang tải...')
    expect(status?.getAttribute('aria-live')).toBe('polite')
    expect(status?.getAttribute('aria-busy')).toBe('true')
    expect(container.inert).toBe(true)

    await act(async () => {
      resolveRoute?.({ default: () => <p>Trang đã tải</p> })
      await Promise.resolve()
    })

    expect(container.textContent).toContain('Trang đã tải')
    expect(document.body.querySelector('[data-loading-screen]')).toBeNull()
    expect(container.inert).toBe(false)
  })

  it('shows a recoverable error state when a route fails to render', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    function FailedRoute(): never {
      throw new Error('route module failed')
    }

    await act(async () => {
      root.render(
        <MemoryRouter>
          <RouteLoadBoundary>
            <FailedRoute />
          </RouteLoadBoundary>
        </MemoryRouter>,
      )
    })

    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Không thể tải trang')
    expect(container.querySelector('button')?.textContent).toBe('Thử lại')
    expect(consoleError).toHaveBeenCalled()
  })

  it('retries a failed route by reloading the current page', async () => {
    const reload = vi.spyOn(window.location, 'reload').mockImplementation(() => {})
    function FailedRoute(): never {
      throw new Error('route module failed')
    }

    await act(async () => {
      root.render(
        <MemoryRouter>
          <RouteLoadBoundary>
            <FailedRoute />
          </RouteLoadBoundary>
        </MemoryRouter>,
      )
    })

    await act(async () => {
      container.querySelector('button')?.click()
    })

    expect(reload).toHaveBeenCalledOnce()
  })

  it('resets the error state when the pathname changes', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    function PathContent() {
      const { pathname } = useLocation()
      if (pathname === '/broken') throw new Error('route module failed')
      return <p>{pathname} route</p>
    }

    function ChangeRoute() {
      const navigate = useNavigate()
      return <button type="button" onClick={() => navigate('/healthy')}>Change route</button>
    }

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/broken']}>
          <ChangeRoute />
          <RouteLoadBoundary>
            <PathContent />
          </RouteLoadBoundary>
        </MemoryRouter>,
      )
    })

    expect(container.querySelector('[role="alert"]')).not.toBeNull()

    await act(async () => {
      container.querySelector('button')?.click()
    })

    expect(container.querySelector('[role="alert"]')).toBeNull()
    expect(container.textContent).toContain('/healthy route')
  })
})
