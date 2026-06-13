export function areMockPaymentsEnabled() {
  return process.env.NODE_ENV !== 'production' && process.env.ENABLE_MOCK_PAYMENTS === 'true';
}
