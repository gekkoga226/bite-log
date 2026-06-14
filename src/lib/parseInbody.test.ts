import { describe, it, expect } from 'vitest'
import { parseInbody } from './parseInbody'

describe('parseInbody', () => {
  it('parses clean JSON', () => {
    const raw = '{"weight":62.5,"bodyFatPercent":18.2,"muscleMass":30.1,"bmi":21.4,"basalMetabolism":1430,"bodyFatMass":11.4}'
    expect(parseInbody(raw)).toEqual({
      weight: 62.5, bodyFatPercent: 18.2, muscleMass: 30.1, bmi: 21.4, basalMetabolism: 1430, bodyFatMass: 11.4,
    })
  })
  it('strips ```json code fences', () => {
    const raw = '```json\n{"weight":70,"bodyFatPercent":20,"muscleMass":32,"bmi":23,"basalMetabolism":1500,"bodyFatMass":14}\n```'
    expect(parseInbody(raw).weight).toBe(70)
  })
  it('rounds to one decimal place', () => {
    const raw = '{"weight":62.547,"bodyFatPercent":18.25,"muscleMass":30,"bmi":21.44,"basalMetabolism":1430,"bodyFatMass":11.39}'
    const r = parseInbody(raw)
    expect(r.weight).toBe(62.5)
    expect(r.bodyFatPercent).toBe(18.3)
  })
  it('defaults missing numeric fields to 0', () => {
    const raw = '{"weight":60}'
    const r = parseInbody(raw)
    expect(r.weight).toBe(60)
    expect(r.muscleMass).toBe(0)
    expect(r.basalMetabolism).toBe(0)
  })
  it('throws when weight is missing', () => {
    expect(() => parseInbody('{"bmi":21}')).toThrow()
  })
})
