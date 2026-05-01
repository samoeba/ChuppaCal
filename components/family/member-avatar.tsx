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
      <img
        src={member.avatar_url}
        alt={member.name}
        className={`${base} object-cover`}
        style={dim}
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
