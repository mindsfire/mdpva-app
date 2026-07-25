"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { createMember, updateMember } from "@/app/actions/members";
import { checkDuplicates, type DuplicateMatch } from "@/app/actions/members";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { MemberDetail } from "@/lib/members-query";
import { memberInputSchema, type MemberInput } from "@/lib/validation/member";
import { PhotoUploader } from "@/components/members/photo-uploader";

const CURRENT_YEAR = new Date().getFullYear();
const FEE_YEARS = Array.from({ length: 11 }, (_, i) => CURRENT_YEAR - 5 + i);

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-mdpva-border bg-mdpva-white p-4 sm:p-5 dark:border-border dark:bg-card">
      <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
    </div>
  );
}

type MemberFormValues = z.input<typeof memberInputSchema>;

function toDefaultValues(member?: MemberDetail | null): MemberFormValues {
  return {
    firstName: member?.firstName ?? "",
    lastName: member?.lastName ?? "",
    email: member?.email ?? null,
    phone: member?.phone ?? null,
    profession: member?.profession ?? null,
    businessName: member?.businessName ?? null,
    addressLine1: member?.addressLine1 ?? "",
    addressLine2: member?.addressLine2 ?? null,
    area: member?.area ?? null,
    city: member?.city ?? "",
    state: member?.state ?? "",
    pincode: member?.pincode ?? null,
    dob: member?.dob ?? null,
    bloodGroup: member?.bloodGroup ?? null,
    status: member?.status ?? "active",
    feesPaidUpto: member?.feesPaidUpto ?? null,
    deathFundCovered: member?.deathFundCovered ?? false,
    notes: member?.notes ?? null,
    legacyId: member?.legacyId ?? null,
  };
}

export function MemberForm({
  mode,
  member,
  onSuccess,
  onCancel,
}: {
  mode: "create" | "edit";
  member?: MemberDetail | null;
  onSuccess?: (result: { id: string; memberId: string }) => void;
  onCancel?: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [duplicates, setDuplicates] = React.useState<DuplicateMatch[]>([]);

  const form = useForm<MemberFormValues, unknown, MemberInput>({
    resolver: zodResolver(memberInputSchema),
    defaultValues: toDefaultValues(member),
  });

  async function runDuplicateCheck(field: "email" | "phone" | "legacyId") {
    const values = form.getValues();
    const email = field === "email" ? (values.email ?? undefined) : undefined;
    const phone = field === "phone" ? (values.phone ?? undefined) : undefined;
    const legacyId =
      field === "legacyId" ? (values.legacyId ?? undefined) : undefined;

    if (!email && !phone && !legacyId) {
      setDuplicates([]);
      return;
    }

    const matches = await checkDuplicates(email, phone, legacyId, member?.id);
    setDuplicates(matches);
  }

  async function onSubmit(values: MemberInput) {
    setIsSubmitting(true);
    try {
      const result =
        mode === "create"
          ? await createMember(values)
          : await updateMember(member!.id, values);

      if (!result.ok) {
        if (result.field) {
          form.setError(result.field as keyof MemberFormValues, {
            message: result.error,
          });
        }
        toast.error(result.error);
        return;
      }

      toast.success(
        mode === "create"
          ? `Member ${result.memberId} created.`
          : "Member updated.",
      );
      onSuccess?.(result);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-5"
      >
        {duplicates.length > 0 ? (
          <div className="rounded-lg border border-mdpva-gold/50 bg-mdpva-gold/10 px-3 py-2 text-sm text-mdpva-accent dark:text-mdpva-gold">
            Possible duplicate:{" "}
            {duplicates
              .map((d) => `${d.firstName} ${d.lastName} (${d.memberId})`)
              .join(", ")}
          </div>
        ) : null}

        <div className="grid items-start gap-5 lg:grid-cols-2">
          <Section title="Contact">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      onBlur={() => {
                        field.onBlur();
                        void runDuplicateCheck("email");
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      onBlur={() => {
                        field.onBlur();
                        void runDuplicateCheck("phone");
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="legacyId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Legacy ID</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      onBlur={() => {
                        field.onBlur();
                        void runDuplicateCheck("legacyId");
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </Section>

          <Section title="Address">
            <FormField
              control={form.control}
              name="addressLine1"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Address line 1</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="addressLine2"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Address line 2</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="area"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Area</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="pincode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pincode</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} maxLength={6} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>City</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="state"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>State</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </Section>

          <Section title="Association">
            <FormField
              control={form.control}
              name="profession"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Profession</FormLabel>
                  <Select
                    value={field.value ?? undefined}
                    onValueChange={(value) => field.onChange(value)}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select profession" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="photographer">Photographer</SelectItem>
                      <SelectItem value="videographer">Videographer</SelectItem>
                      <SelectItem value="both">Photo &amp; Video</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="businessName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Business name</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="dob"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date of birth</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} type="date" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="bloodGroup"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Blood group</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="sm:col-span-2">
              <PhotoUploader
                key={member?.id ?? "new"}
                memberId={member?.id}
                photoKey={member?.photoKey ?? null}
              />
            </div>
          </Section>

          <Section title="Fees & notes">
            <FormField
              control={form.control}
              name="feesPaidUpto"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fees paid upto</FormLabel>
                  <div className="flex items-center gap-2">
                    <Select
                      value={field.value ? String(field.value) : undefined}
                      onValueChange={(value) => field.onChange(Number(value))}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Not paid" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {FEE_YEARS.map((year) => (
                          <SelectItem key={year} value={String(year)}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => field.onChange(CURRENT_YEAR)}
                    >
                      Mark paid for {CURRENT_YEAR}
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="deathFundCovered"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Death fund</FormLabel>
                  <button
                    type="button"
                    aria-pressed={field.value}
                    onClick={() => field.onChange(!field.value)}
                    className={cn(
                      "flex h-8 w-fit items-center justify-center rounded-lg border px-3 text-sm font-medium transition-colors",
                      field.value
                        ? "border-mdpva-accent bg-mdpva-accent text-mdpva-cream dark:bg-mdpva-gold dark:text-mdpva-ink"
                        : "border-input bg-transparent text-muted-foreground",
                    )}
                  >
                    {field.value ? "Covered" : "Not covered"}
                  </button>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <textarea
                      {...field}
                      value={field.value ?? ""}
                      rows={3}
                      className="w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </Section>
        </div>

        {/* Sticky so Save stays reachable without scrolling to the bottom
            of a long form. Negative margins let it span the page gutters. */}
        <div className="sticky bottom-0 z-10 -mx-4 flex justify-end gap-2 border-t border-mdpva-border bg-mdpva-paper/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 dark:border-border dark:bg-background/95">
          {onCancel ? (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? "Saving…"
              : mode === "create"
                ? "Create member"
                : "Save changes"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
