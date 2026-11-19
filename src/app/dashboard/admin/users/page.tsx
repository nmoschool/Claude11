import { requireStaffPage } from "@/lib/guard";
import { listClasses } from "@/lib/classes";
import UsersAdmin from "@/components/UsersAdmin";
import { grantablePermissions } from "@/lib/userAdmin";

export default async function UsersPage() {
  const ctx = await requireStaffPage("users:manage");
  const classes = await listClasses({ ...ctx, classWhere: () => ({ schoolId: ctx.schoolId }) });
  return (
    <UsersAdmin
      meId={ctx.id}
      myPerms={grantablePermissions(ctx)}
      isSuper={ctx.role === "SUPER_ADMIN"}
      canAssignAdmin={ctx.role === "SUPER_ADMIN" || ctx.role === "SCHOOL_ADMIN"}
      classes={classes.map((c) => ({ id: c.id, label: c.label }))}
    />
  );
}
