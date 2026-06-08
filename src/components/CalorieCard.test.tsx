import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CalorieCard } from './CalorieCard'

describe('CalorieCard', () => {
  it('shows consumed, target and remaining calories', () => {
    render(<CalorieCard consumed={1350} target={1800} />)
    expect(screen.getByText('1,350')).toBeInTheDocument()
    expect(screen.getByText(/1,800/)).toBeInTheDocument()
    expect(screen.getByText(/450/)).toBeInTheDocument()
  })
  it('clamps remaining at 0 when over target', () => {
    render(<CalorieCard consumed={2000} target={1800} />)
    expect(screen.getByText(/0 kcal/)).toBeInTheDocument()
  })
})
