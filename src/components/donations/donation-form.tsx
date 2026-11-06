"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import {
  createDonation,
  updateDonation,
  type DonationActionResult,
} from "@/app/actions/donations";
import { PhotoPicker } from "@/components/donations/photo-picker";
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
  donationSchema,
  formatAmount,
  parseAmount,
  type DonationValues,
} from "@/lib/donations/validation";

type Editing = {
  id: string;
  name: string;
  businessName: string | null;
  amount: number;
  photoSrc: string;
};

export function DonationForm({ donation }: { donation?: Editing }) {
  const router = useRouter();
  const [submitting, setSubmitting] = React.useState(false);
  const [photo, setPhoto] = React.useState<Blob | null>(null);
  const [photoError, setPhotoError] = React.useState<string>();

  const form = useForm<DonationValues>({
    resolver: zodResolver(donationSchema),
    defaultValues: {
      name: donation?.name ?? "",
      businessName: donation?.businessName ?? "",
      amount: donation ? formatAmount(donation.amount) : "",
    },
  });

  async function onSubmit(values: DonationValues) {
    if (!donation && !photo) {
      setPhotoError("Add the donor's photo.");
      return;
    }

    const formData = new FormData();
    formData.set("name", values.name);
    formData.set("businessName", values.businessName);
    formData.set("amount", values.amount);
    if (photo) formData.set("photo", photo, "photo");

    setSubmitting(true);
    let result: DonationActionResult;
    try {
      result = donation
        ? await updateDonation(donation.id, formData)
        : await createDonation(formData);
    } catch {
      toast.error("That didn't save. Please try again.");
      setSubmitting(false);
      return;
    }

    if (result.ok) {
      toast.success(donation ? "Donation updated." : "Donation added.");
      router.push(`/donations/${result.id}`);
      router.refresh();
      return;
    }

    setSubmitting(false);
    if (result.field === "photo") {
      setPhotoError(result.error);
    } else if (result.field) {
      form.setError(result.field as keyof DonationValues, {
        message: result.error,
      });
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex max-w-md flex-col gap-5"
        noValidate
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input
                  placeholder="Kannada or English"
                  autoComplete="off"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="businessName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Business name{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </FormLabel>
              <FormControl>
                <Input autoComplete="off" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Amount (₹)</FormLabel>
              <FormControl>
                <Input
                  inputMode="numeric"
                  autoComplete="off"
                  {...field}
                  onChange={(event) => {
                    const amount = parseAmount(event.target.value);
                    field.onChange(
                      amount === null ? event.target.value : formatAmount(amount),
                    );
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <PhotoPicker
          currentSrc={donation?.photoSrc ?? null}
          error={photoError}
          onChange={(blob) => {
            setPhoto(blob);
            setPhotoError(undefined);
          }}
        />

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-10 flex-1"
            onClick={() => router.back()}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" className="h-10 flex-1" disabled={submitting}>
            {submitting ? "Saving…" : donation ? "Save" : "Save and create card"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
