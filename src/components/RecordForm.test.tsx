import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RecordForm } from './RecordForm'

describe('RecordForm', () => {
  it('submits with the entered memo and selected meal type', () => {
    const onSubmit = vi.fn()
    render(<RecordForm initialMealType="昼食" submitting={false} onSubmit={onSubmit} />)
    fireEvent.change(screen.getByPlaceholderText('例: 牛丼'), { target: { value: 'ラーメン' } })
    fireEvent.click(screen.getByText('記録する'))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ memo: 'ラーメン', mealType: '昼食' }))
  })
  it('disables submit button while submitting', () => {
    render(<RecordForm initialMealType="朝食" submitting={true} onSubmit={vi.fn()} />)
    expect(screen.getByText('計算中…')).toBeDisabled()
  })
})
