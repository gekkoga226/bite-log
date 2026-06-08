import { describe, it, expect } from 'vitest'
import { stripDataUrlPrefix } from './fileToBase64'

describe('stripDataUrlPrefix', () => {
  it('removes the data URL prefix and returns raw base64', () => {
    const dataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRg=='
    expect(stripDataUrlPrefix(dataUrl)).toBe('/9j/4AAQSkZJRg==')
  })
  it('returns input unchanged when no prefix present', () => {
    expect(stripDataUrlPrefix('abc123')).toBe('abc123')
  })
})
