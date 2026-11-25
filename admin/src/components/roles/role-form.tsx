"use client";

import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { notify } from "@/lib/notify";
import { usePermissionGroups } from "@/lib/queries";
import { ApiError, type Role } from "@cendol/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";

interface RoleFormProps {
  role?: Role;
  onSaved?: (role: Role) => void;
}

export function RoleForm({ role, onSaved }: RoleFormProps) {
  const groups = usePermissionGroups();
  const queryClient = useQueryClient();
  const [label, setLabel] = useState(role?.label ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [permissions, setPermissions] = useState<string[]>(role?.permissions ?? ["admin.access"]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const toggle = (name: string, on: boolean) => setPermissions((current) => (on ? [...current, name] : current.filter((p) => p !== name)));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const body = { label, description: description || null, permissions };
      const result = role
        ? await api.put<{ message: string; data: Role }>(`admin/roles/${role.name}`, body)
        : await api.post<{ message: string; data: Role }>("admin/roles", body);
      notify.success(result.message);
      await queryClient.invalidateQueries({ queryKey: ["roles"] });
      void queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      onSaved?.(result.data);
    } catch (error) {
      if (error instanceof ApiError && error.code === "VALIDATION_FAILED") {
        setErrors({ label: error.fieldError("label") ?? "", description: error.fieldError("description") ?? "" });
      }
      notify.error(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="role-form flex flex-col gap-6" onSubmit={submit}>
      <section className="role-form-details panel-card flex flex-col gap-5">
        <h2 className="panel-card-title">About this role</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField id="role-label" label="Role name" error={errors.label} hint={role?.is_system ? "Built-in roles keep their name." : undefined}>
            <Input id="role-label" value={label} onChange={(e) => setLabel(e.target.value)} disabled={role?.is_system} required maxLength={60} />
          </FormField>
          <FormField id="role-description" label="What is it for?" error={errors.description}>
            <Textarea id="role-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={200} />
          </FormField>
        </div>
      </section>

      <section className="role-form-permissions panel-card flex flex-col gap-5">
        <div>
          <h2 className="panel-card-title">Permissions</h2>
          <p className="panel-card-description">Tick everything people with this role may do. New areas (news, directory, reports) add their permissions here.</p>
        </div>
        {groups.isPending ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <div className="permission-groups grid gap-5 sm:grid-cols-2">
            {groups.data?.map((group) => {
              const names = group.permissions.map((p) => p.name);
              const all = names.every((n) => permissions.includes(n));
              const some = names.some((n) => permissions.includes(n));
              return (
                <fieldset key={group.group} className="permission-group flex flex-col gap-2 rounded-lg border p-4">
                  <legend className="sr-only">{group.label}</legend>
                  <label htmlFor={`group-${group.group}`} className="permission-group-header flex items-center gap-2 font-medium">
                    <Checkbox
                      id={`group-${group.group}`}
                      checked={all ? true : some ? "indeterminate" : false}
                      onCheckedChange={(checked) =>
                        setPermissions((current) => (checked ? Array.from(new Set([...current, ...names])) : current.filter((p) => !names.includes(p))))
                      }
                    />
                    {group.label}
                  </label>
                  <ul className="permission-list flex flex-col gap-1.5 pl-6">
                    {group.permissions.map((permission) => (
                      <li key={permission.name}>
                        <label htmlFor={`perm-${permission.name}`} className="permission-option flex items-center gap-2 text-sm">
                          <Checkbox
                            id={`perm-${permission.name}`}
                            checked={permissions.includes(permission.name)}
                            onCheckedChange={(checked) => toggle(permission.name, Boolean(checked))}
                          />
                          {permission.label}
                        </label>
                      </li>
                    ))}
                  </ul>
                </fieldset>
              );
            })}
          </div>
        )}
      </section>

      <div className="role-form-actions flex justify-end">
        <Button type="submit" disabled={busy || !label.trim()}>
          {busy ? <Loader2 className="animate-spin" /> : null}
          {role ? "Save role" : "Create role"}
        </Button>
      </div>
    </form>
  );
}
