import type { UserRole } from "@/types/database";

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Адмін",
  manager: "Керівник",
  viewer: "CEO / Спостерігач",
};
