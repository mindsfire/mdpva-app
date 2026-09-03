import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { initials } from "./member-badges";
import { fullName } from "@/lib/member-name";
import { photoUrl } from "@/lib/photo-url";

export function MemberAvatar({
  firstName,
  lastName,
  photoKey,
  updatedAt,
  size,
  className,
}: {
  firstName: string;
  lastName: string | null;
  photoKey: string | null;
  updatedAt: Date | null;
  size?: "default" | "sm" | "lg";
  className?: string;
}) {
  const src = photoUrl(photoKey, updatedAt);
  return (
    <Avatar
      size={size}
      className={cn(
        "ring-2 ring-mdpva-gold/70 after:border-transparent",
        className,
      )}
    >
      {src ? <AvatarImage src={src} alt={fullName(firstName, lastName)} /> : null}
      <AvatarFallback className="bg-mdpva-gold/20 font-serif text-mdpva-accent dark:text-mdpva-gold">
        {initials(firstName, lastName)}
      </AvatarFallback>
    </Avatar>
  );
}
