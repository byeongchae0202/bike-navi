export function lowPassFilter(input: number, previous: number, alpha: number) {
  return previous + alpha * (input - previous)
}
