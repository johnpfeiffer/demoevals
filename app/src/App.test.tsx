// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import App from './App'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('evaluation loop UI', () => {
  it('rescores through MUI sliders and switches, commits, and resets', () => {
    render(<App />)
    expect(screen.getByRole('button', { name: 'Choose “green”' })).toBeTruthy()

    fireEvent.change(screen.getByRole('slider', { name: 'Logical series influence' }), {
      target: { value: '0' },
    })
    expect(screen.getByRole('button', { name: 'Choose “white”' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Choose “white”' }))
    expect(screen.getByLabelText('Current context words').textContent).toBe('redbluewhitenext word?')

    // The repeat gate excludes blue until the switch is turned off.
    const candidates = screen.getByRole('region', { name: '3. Candidate words, rescored' })
    expect(candidates.textContent).not.toContain('blue')
    fireEvent.click(screen.getByRole('switch', { name: /Block repeated words/ }))
    expect(candidates.textContent).toContain('blue')

    fireEvent.click(screen.getByRole('switch', { name: /Logical series colors/ }))
    expect((screen.getByRole('slider', { name: 'Logical series influence' }) as HTMLInputElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('switch', { name: /Americana red/ }))
    fireEvent.click(screen.getByRole('switch', { name: /Science light/ }))
    expect(screen.getByRole('alert').textContent).toContain('No evals are active')

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
    expect(screen.getByLabelText('Current context words').textContent).toBe('redbluenext word?')
    expect(screen.getByRole('button', { name: 'Choose “green”' })).toBeTruthy()
    expect((screen.getByRole('slider', { name: 'Logical series influence' }) as HTMLInputElement).value).toBe('70')
  })

  it('shows loading, accepts live candidates, and rescores without refetching', async () => {
    let resolveResponse!: (response: Response) => void
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => { resolveResponse = resolve }))
    vi.stubGlobal('fetch', fetchMock)
    render(<App />)
    fireEvent.click(screen.getByRole('switch', { name: 'Live LLM' }))
    expect(screen.getByRole('progressbar', { name: 'Fetching live candidates' })).toBeTruthy()
    expect(screen.getAllByText('Live LLM')).toHaveLength(2)
    expect((screen.getByRole('button', { name: 'Choose “green”' }) as HTMLButtonElement).disabled).toBe(true)

    await act(async () => {
      resolveResponse(new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({
          candidates: [{ word: 'spectrum', plausibility: 80, fits: { logical: 50, americana: 0, science: 100 } }],
        }) } }],
      })))
    })
    expect(screen.queryByRole('progressbar', { name: 'Fetching live candidates' })).toBeNull()
    expect((screen.getByRole('button', { name: 'Choose “spectrum”' }) as HTMLButtonElement).disabled).toBe(false)
    fireEvent.change(screen.getByRole('slider', { name: 'Science influence' }), { target: { value: '100' } })
    fireEvent.click(screen.getByRole('switch', { name: 'LLM judge' }))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('shows a warning and keeps the offline loop usable after a live failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Unavailable', { status: 503 })))
    render(<App />)
    fireEvent.click(screen.getByRole('switch', { name: 'Live LLM' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Showing the offline sampler instead')
    expect((screen.getByRole('button', { name: 'Choose “green”' }) as HTMLButtonElement).disabled).toBe(false)
  })
})
