"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { changePasswordAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const schema = z
  .object({
    current: z.string().min(1, "Current password is required."),
    next: z.string().min(10, "New password must be at least 10 characters."),
    confirm: z.string().min(1, "Confirm your new password."),
  })
  .refine((v) => v.next === v.confirm, {
    message: "Passwords do not match.",
    path: ["confirm"],
  });

type Values = z.infer<typeof schema>;

export function ChangePasswordForm() {
  const router = useRouter();
  const { update } = useSession();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { current: "", next: "", confirm: "" },
  });

  async function onSubmit(values: Values) {
    setFormError(null);
    setPending(true);
    try {
      const result = await changePasswordAction(values.current, values.next);
      if (result.error) {
        setFormError(result.error);
        return;
      }
      // Force the JWT to re-check `must_change_password` against the db now
      // rather than waiting for the periodic recheck window.
      // In next-auth v5, update() with no args sends a GET that does NOT trigger
      // the jwt callback's `trigger === "update"` branch. Passing an empty object
      // sends a POST that fires the update trigger and refreshes the session.
      await update({});
      router.push("/");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex w-full flex-col gap-5"
        noValidate
      >
        <FormField
          control={form.control}
          name="current"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Current password</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="current-password"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="next"
          render={({ field }) => (
            <FormItem>
              <FormLabel>New password</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="new-password"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="confirm"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirm new password</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="new-password"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {formError ? (
          <p
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {formError}
          </p>
        ) : null}

        <Button type="submit" className="mt-1 h-10 w-full" disabled={pending}>
          {pending ? "Updating…" : "Update password"}
        </Button>
      </form>
    </Form>
  );
}
