// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import Footer from './Footer'

describe('Footer', () => {
  it('renders the built-by line with LinkedIn and GitHub links', () => {
    const { container } = render(<Footer />)
    expect(container.textContent).toContain('Built by John Pfeiffer')

    const links = container.querySelectorAll('a')
    expect(links).toHaveLength(2)

    const linkedin = links[0]
    expect(linkedin.getAttribute('href')).toBe('https://www.linkedin.com/in/foupfeiffer')
    expect(linkedin.getAttribute('aria-label')).toBe('John Pfeiffer on LinkedIn')
    expect(linkedin.getAttribute('target')).toBe('_blank')
    expect(linkedin.getAttribute('rel')).toBe('noopener noreferrer')

    const github = links[1]
    expect(github.getAttribute('href')).toBe('https://github.com/johnpfeiffer/demoevals')
    expect(github.getAttribute('aria-label')).toBe('Source code on GitHub')
    expect(github.getAttribute('target')).toBe('_blank')
    expect(github.getAttribute('rel')).toBe('noopener noreferrer')
  })
})
