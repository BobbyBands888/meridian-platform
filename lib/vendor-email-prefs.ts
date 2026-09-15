import "server-only";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isVendorEmailToken = (token: unknown): token is string => typeof token === "string" && UUID.test(token);

export const vendorEmailsPath = (token: string) => `/vendors/emails?token=${token}`;
