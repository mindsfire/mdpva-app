import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { initials } from "./member-badges";

export function MemberAvatar({
  firstName,
  lastName,
  photoKey,
  size,
  className,
}: {
  firstName: string;
  lastName: string;
  photoKey: string | null;
  size?: "default" | "sm" | "lg";
  className?: string;
}) {
  return (
    <Avatar
      size={size}
      className={cn(
        "ring-2 ring-mdpva-gold/70 after:border-transparent",
        className,
      )}
    >
      {photoKey ? (
        <AvatarImage
          src={`/api/photos/${photoKey}`}
          alt={`${firstName} ${lastName}`}
        />
      ) : null}
      <AvatarFallback className="bg-mdpva-gold/20 font-serif text-mdpva-accent dark:text-mdpva-gold">
        {initials(firstName, lastName)}
      </AvatarFallback>
    </Avatar>
  );
}
