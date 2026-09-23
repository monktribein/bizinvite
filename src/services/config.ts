export const isMockEnabled = (): boolean => {
  // If explicitly configured to false, use real API
  if (process.env.NEXT_PUBLIC_USE_MOCK_API === "false") {
    return false;
  }
  // Default to mock mode in local/dev or when unset
  return true;
};
