import type { FamilyMember } from "@/lib/types";

interface Props {
  member: Pick<FamilyMember, "avatar_url" | "avatar_emoji" | "color" | "name">;
  size: number;
  emojiClassName?: string;
  className?: string;
}

export default function MemberAvatar({ member, size, emojiClassName = "text-2xl", className = "" }: Props) {
  const base = `rounded-full flex-shrink-0 ${className}`;
  const dim = { width: size, height: size };

  if (member.avatar_url) {
    return (
      // Avatars are already resized to 512px at upload; preserve arbitrary Supabase URLs.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={member.avatar_url}
        alt={member.name}
        className={`${base} object-cover`}
        style={dim}
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div
      className={`${base} flex items-center justify-center ${emojiClassName}`}
      style={{ ...dim, backgroundColor: member.color + "30" }}
    >
      {member.avatar_emoji}
    </div>
  );
}
