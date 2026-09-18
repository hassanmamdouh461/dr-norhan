export const isMockMode = (): boolean => {
  if (process.env.NODE_ENV === 'production') {
    return false;
  }
  if (typeof window === 'undefined') {
    return false;
  }
  return process.env.NEXT_PUBLIC_ENABLE_MOCK === 'true';
};
