// createClient() returns whatever the running test installed on globalThis.__fakeSupabase.
export function createClient() {
  if (!globalThis.__fakeSupabase) throw new Error("test did not install globalThis.__fakeSupabase");
  return globalThis.__fakeSupabase;
}
export function createServiceClient() { return createClient(); }
export async function getUser() {
  const { data } = await createClient().auth.getUser();
  return data.user;
}
