"use client";

import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { useRoles } from "@/lib/queries";
import { ApiError, type User } from "@cendol/api-client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

/** Which part of the person's record this form edits. "create" shows everything. */
export type UserFormSection = "create" | "profile" | "access";

const schema = z.object({
  name: z.string().trim().min(1, "Please enter a name.").max(120),
  email: z.string().trim().min(1, "Please enter an email.").email("That email doesn't look right."),
  phone: z.string().trim().max(20).optional(),
  password: z.string().optional(),
  status: z.enum(["active", "suspended", "banned"]),
  user_type: z.enum(["none", "local", "tourist"]),
  roles: z.array(z.string()),
  mark_verified: z.boolean(),
});

type Values = z.infer<typeof schema>;

interface UserFormProps {
  section: UserFormSection;
  user?: User;
  onSaved?: (user: User) => void;
}

export function UserForm({ section, user, onSaved }: UserFormProps) {
  const { user: me, can } = useAuth();
  const queryClient = useQueryClient();
  const roles = useRoles();
  const creating = section === "create";
  const showProfile = creating || section === "profile";
  const showAccess = creating || section === "access";
  const readOnly = !creating && !can("users.update");

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: user?.name ?? "",
      email: user?.email ?? "",
      phone: user?.phone ?? "",
      password: "",
      status: user?.status ?? "active",
      user_type: user?.profile?.user_type ?? "none",
      roles: user?.roles?.map((r) => r.name) ?? (creating ? ["member"] : []),
      mark_verified: creating,
    },
  });
  const { register, handleSubmit, control, setError, formState } = form;
  const errors = formState.errors;

  async function save(values: Values) {
    if (creating && (!values.password || values.password.length < 10)) {
      setError("password", { message: "Please set a password of at least 10 characters." });
      return;
    }
    const payload = {
      ...values,
      phone: values.phone || null,
      password: values.password || null,
      user_type: values.user_type === "none" ? null : values.user_type,
    };
    try {
      const result = creating
        ? await api.post<{ message: string; data: User }>("admin/users", payload)
        : await api.put<{ message: string; data: User }>(`admin/users/${user!.id}`, payload);
      notify.success(result.message);
      await queryClient.invalidateQueries({ queryKey: ["listing", "users"] });
      queryClient.setQueryData(["user", result.data.id], result.data);
      if (result.data.id === me?.id) void queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      form.reset({ ...values, password: "" });
      onSaved?.(result.data);
    } catch (error) {
      if (error instanceof ApiError && error.code === "VALIDATION_FAILED") {
        for (const field of Object.keys(error.errors)) {
          setError(field.split(".")[0] as keyof Values, { message: error.errors[field][0] });
        }
        notify.error(error);
      } else {
        notify.error(error);
      }
    }
  }

  const isSelf = user?.id === me?.id;

  return (
    <form className="user-form flex flex-col gap-6" onSubmit={handleSubmit(save)} noValidate>
      {showProfile ? (
        <fieldset className="user-form-profile panel-card flex flex-col gap-5" disabled={readOnly}>
          <legend className="sr-only">Details</legend>
          <div>
            <h2 className="panel-card-title">Details</h2>
            <p className="panel-card-description">How this person signs in and how we contact them.</p>
          </div>
          <div className="user-form-grid grid gap-5 sm:grid-cols-2">
            <FormField id="user-name" label="Full name" error={errors.name?.message}>
              <Input id="user-name" autoComplete="off" aria-invalid={Boolean(errors.name)} {...register("name")} />
            </FormField>
            <FormField id="user-email" label="Email" error={errors.email?.message}>
              <Input id="user-email" type="email" autoComplete="off" aria-invalid={Boolean(errors.email)} {...register("email")} />
            </FormField>
            <FormField id="user-phone" label="Phone (optional)" error={errors.phone?.message} hint="Malaysian numbers like 012-345 6789 are fine.">
              <Input id="user-phone" type="tel" autoComplete="off" {...register("phone")} />
            </FormField>
            <FormField id="user-type" label="Local or tourist">
              <Controller
                control={control}
                name="user_type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={readOnly}>
                    <SelectTrigger id="user-type" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not set</SelectItem>
                      <SelectItem value="local">Local (lives in Melaka)</SelectItem>
                      <SelectItem value="tourist">Tourist / visitor</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
            <FormField
              id="user-password"
              label={creating ? "Password" : "New password (optional)"}
              error={errors.password?.message}
              hint={creating ? "At least 10 characters. Ask them to change it after signing in." : "Leave empty to keep their current password."}
            >
              <Input id="user-password" type="password" autoComplete="new-password" aria-invalid={Boolean(errors.password)} {...register("password")} />
            </FormField>
            {creating || !user?.is_verified ? (
              <div className="user-form-verified flex items-center gap-3 self-center pt-5">
                <Controller
                  control={control}
                  name="mark_verified"
                  render={({ field }) => <Switch id="user-verified" checked={field.value} onCheckedChange={field.onChange} />}
                />
                <Label htmlFor="user-verified" className="font-normal">
                  Mark email as confirmed
                </Label>
              </div>
            ) : null}
          </div>
        </fieldset>
      ) : null}

      {showAccess ? (
        <fieldset className="user-form-access panel-card flex flex-col gap-5" disabled={readOnly}>
          <legend className="sr-only">Access</legend>
          <div>
            <h2 className="panel-card-title">Access</h2>
            <p className="panel-card-description">Roles decide what this person can do. A person can have several.</p>
          </div>
          <FormField id="user-status" label="Account status" hint={isSelf ? "You can't suspend your own account." : "Suspended and banned people are signed out and can't sign in."}>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={readOnly || isSelf}>
                  <SelectTrigger id="user-status" className="w-full sm:w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="banned">Banned</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
          <div className="user-form-roles flex flex-col gap-2">
            <span className="text-sm font-medium">Roles</span>
            {errors.roles?.message ? <p className="field-error">{errors.roles.message}</p> : null}
            <Controller
              control={control}
              name="roles"
              render={({ field }) => (
                <ul className="role-picker grid gap-2 sm:grid-cols-2">
                  {(roles.data ?? []).map((role) => {
                    const checked = field.value.includes(role.name);
                    const locked = role.name === "super-admin" && !me?.permissions?.includes("*");
                    return (
                      <li key={role.name}>
                        <label
                          htmlFor={`role-${role.name}`}
                          className={[
                            "role-picker-option flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                            checked ? "is-checked border-pandan-400 bg-pandan-50 dark:bg-pandan-950" : "hover:bg-muted",
                            locked ? "cursor-not-allowed opacity-60" : "",
                          ].join(" ")}
                        >
                          <Checkbox
                            id={`role-${role.name}`}
                            checked={checked}
                            disabled={locked || readOnly}
                            onCheckedChange={(next) =>
                              field.onChange(next ? [...field.value, role.name] : field.value.filter((name) => name !== role.name))
                            }
                          />
                          <span className="flex flex-col">
                            <span className="role-picker-label text-sm font-medium">{role.label}</span>
                            {role.description ? <span className="role-picker-description text-xs text-muted-foreground">{role.description}</span> : null}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            />
          </div>
        </fieldset>
      ) : null}

      {!readOnly ? (
        <div className="user-form-actions flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => form.reset()} disabled={!formState.isDirty || formState.isSubmitting}>
            Undo changes
          </Button>
          <Button type="submit" disabled={formState.isSubmitting || (!creating && !formState.isDirty)}>
            {formState.isSubmitting ? <Loader2 className="animate-spin" /> : null}
            {creating ? "Add user" : "Save changes"}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
