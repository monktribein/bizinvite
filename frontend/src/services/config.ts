export const isMockEnabled = (): boolean => {
  // Mock mode keeps data in browser memory only (lost on refresh), so it must be opted into explicitly
  return process.env.NEXT_PUBLIC_USE_MOCK_API === "true";
};
