import '@testing-library/jest-dom/vitest'

// jsdom lacks object URLs – components under test only need stubs.
if (!('createObjectURL' in URL)) {
  Object.assign(URL, { createObjectURL: () => 'blob:jsdom', revokeObjectURL: () => undefined })
}
