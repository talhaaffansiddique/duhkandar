import { useAuth } from "../context/AuthContext";
import { useShopCollection } from "./firestore";
import type { PermissionKey, PermissionSet, Role } from "../types";
import { PERMISSION_KEYS } from "../types";

export const ALL_PERMISSIONS_ON: PermissionSet = PERMISSION_KEYS.reduce(
  (acc, k) => ({ ...acc, [k]: true }),
  {} as PermissionSet
);

export const NO_PERMISSIONS: PermissionSet = PERMISSION_KEYS.reduce(
  (acc, k) => ({ ...acc, [k]: false }),
  {} as PermissionSet
);

export function usePermissions() {
  const { profile } = useAuth();
  const { data: roles } = useShopCollection<Role>("roles");

  if (!profile) {
    return { permissions: NO_PERMISSIONS, isAdmin: false, roleName: null as string | null };
  }
  if (profile.access === "Admin") {
    return { permissions: ALL_PERMISSIONS_ON, isAdmin: true, roleName: "Admin" };
  }
  const role = roles.find((r) => r.id === profile.roleId);
  return {
    permissions: role?.permissions ?? NO_PERMISSIONS,
    isAdmin: false,
    roleName: role?.name ?? null,
  };
}

export function can(permissions: PermissionSet, key: PermissionKey) {
  return !!permissions[key];
}
