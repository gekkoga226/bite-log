import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SettingsScreen } from './SettingsScreen'

vi.mock('../services/settings', () => ({
  saveGoals: vi.fn(),
}))
import { saveGoals } from '../services/settings'

const baseGoals = { calories: 1800, protein: 93, fat: 42, carbs: 195 }

describe('SettingsScreen', () => {
  it('renders current goal values as input field values', () => {
    render(<SettingsScreen token="tok" goals={baseGoals} onSaved={vi.fn()} />)
    expect(screen.getByDisplayValue('1800')).toBeInTheDocument()
    expect(screen.getByDisplayValue('93')).toBeInTheDocument()
    expect(screen.getByDisplayValue('42')).toBeInTheDocument()
    expect(screen.getByDisplayValue('195')).toBeInTheDocument()
  })

  it('calls saveGoals and onSaved with current values on success', async () => {
    vi.mocked(saveGoals).mockResolvedValueOnce(undefined)
    const onSaved = vi.fn()
    render(<SettingsScreen token="tok" goals={baseGoals} onSaved={onSaved} />)

    fireEvent.click(screen.getByRole('button', { name: '保存する' }))
    await waitFor(() => expect(saveGoals).toHaveBeenCalledWith('tok', baseGoals))
    expect(onSaved).toHaveBeenCalledWith(baseGoals)
    expect(screen.getByText('保存しました')).toBeInTheDocument()
  })

  it('shows error message on save failure', async () => {
    vi.mocked(saveGoals).mockRejectedValueOnce(new Error('fail'))
    render(<SettingsScreen token="tok" goals={baseGoals} onSaved={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: '保存する' }))
    await waitFor(() =>
      expect(screen.getByText('保存に失敗しました。もう一度お試しください。')).toBeInTheDocument(),
    )
  })

  it('disables save button when a field is cleared', () => {
    render(<SettingsScreen token="tok" goals={baseGoals} onSaved={vi.fn()} />)
    fireEvent.change(screen.getByDisplayValue('1800'), { target: { value: '' } })
    expect(screen.getByRole('button', { name: '保存する' })).toBeDisabled()
  })
})
