// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import i18n from '../../i18n'
import NotFoundPage from './NotFoundPage'
import styles from './NotFoundPage.module.css'

function LocationOutput() {
  const location = useLocation()
  const navigate = useNavigate()
  return (
    <>
      <output data-testid="location">{location.pathname}</output>
      <button type="button" data-testid="leave-page" onClick={() => navigate('/destination')}>
        Leave page
      </button>
    </>
  )
}

let root: Root
let container: HTMLDivElement
let previousDocumentTitle: string

beforeEach(async () => {
  await i18n.changeLanguage('vi')
  previousDocumentTitle = 'UTH Online Judge'
  document.title = previousDocumentTitle
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  await i18n.changeLanguage('vi')
})

async function renderPage(initialEntry = '/unknown-route') {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/destination" element={<p>Destination</p>} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        <LocationOutput />
      </MemoryRouter>,
    )
  })
}

describe('NotFoundPage', () => {
  it('renders accessible localized content over the illustration without CTAs', async () => {
    await renderPage()

    const main = container.querySelector('main#main-content')
    const image = container.querySelector<HTMLImageElement>(`main .${styles.illustration}`)
    expect(main).not.toBeNull()
    expect(container.querySelector('h1')?.textContent).toBe('Ối! Bạn đi lạc rồi!')
    expect(image?.getAttribute('alt')).toBe(
      'Chú gấu trúc đỏ cầm bản đồ, đang bối rối tìm đường.',
    )
    expect(image?.getAttribute('width')).toBe('1366')
    expect(image?.getAttribute('height')).toBe('768')
    expect(main?.querySelector('[class*=terminal]')).toBeNull()
    expect(main?.querySelector('nav, a, button')).toBeNull()
    expect(document.title).toBe('404 — Không tìm thấy trang | UTH Online Judge')
  })

  it('updates localized content and document title when the language changes', async () => {
    await renderPage()

    await act(async () => {
      await i18n.changeLanguage('en')
    })

    expect(container.querySelector('h1')?.textContent).toBe("Oops! You're lost!")
    expect(document.title).toBe('404 — Page not found | UTH Online Judge')
    expect(container.querySelector(`.${styles.illustration}`)?.getAttribute('alt')).toBe(
      'A red panda holding a map and looking for the way.',
    )
  })

  it('restores the previous document title when leaving the not-found route', async () => {
    await renderPage()

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="leave-page"]')?.click()
    })

    expect(container.querySelector('[data-testid="location"]')?.textContent).toBe('/destination')
    expect(container.textContent).toContain('Destination')
    expect(document.title).toBe(previousDocumentTitle)
  })

  it('does not overwrite a title that another page sets before it unmounts', async () => {
    await renderPage()
    document.title = 'Next route title'

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="leave-page"]')?.click()
    })

    expect(document.title).toBe('Next route title')
  })
})
