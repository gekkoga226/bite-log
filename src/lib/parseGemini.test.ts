import { describe, it, expect } from 'vitest'
import { parseNutrition } from './parseGemini'

describe('parseNutrition', () => {
  it('parses clean JSON', () => {
    const raw = '{"calories":620,"protein":35,"fat":18,"carbs":70,"comment":"バランス良好"}'
    expect(parseNutrition(raw)).toEqual({
      calories: 620, protein: 35, fat: 18, carbs: 70, comment: 'バランス良好',
    })
  })
  it('strips ```json code fences', () => {
    const raw = '```json\n{"calories":300,"protein":10,"fat":5,"carbs":50,"comment":"間食"}\n```'
    expect(parseNutrition(raw).calories).toBe(300)
  })
  it('rounds numeric fields to integers', () => {
    const raw = '{"calories":619.7,"protein":35.4,"fat":17.9,"carbs":70.1,"comment":"x"}'
    const r = parseNutrition(raw)
    expect(r.calories).toBe(620)
    expect(r.protein).toBe(35)
  })
  it('throws on missing calories field', () => {
    const raw = '{"protein":10}'
    expect(() => parseNutrition(raw)).toThrow()
  })
})
