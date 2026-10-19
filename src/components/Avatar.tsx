import type { User } from '../types';

export const initials = (name: string) =>
  name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';

export function Avatar({ user, size = 26 }: { user: User; size?: number }) {
  return (
    <span className="avatar" style={{ background: user.color, width: size, height: size, fontSize: size * 0.42 }} title={user.name}>
      {initials(user.name)}
    </span>
  );
}
