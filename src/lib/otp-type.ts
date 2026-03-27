// Replaces the Prisma-generated OtpType enum.
// Values must match the MySQL ENUM definition in schema.sql.
export const OtpType = {
  LOGIN:   "LOGIN",
  UNBLOCK: "UNBLOCK",
} as const;

export type OtpType = (typeof OtpType)[keyof typeof OtpType];
