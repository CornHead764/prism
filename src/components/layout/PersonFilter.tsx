'use client';

import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

export interface PersonFilterProps {
  members: Array<{ id: string; name: string; color: string; avatarUrl?: string | null }>;
  selected: string | null;
  onSelect: (id: string | null) => void;
  className?: string;
}

export function PersonFilter({ members, selected, onSelect, className }: PersonFilterProps) {
  return (
    <div className={cn('flex gap-1 shrink-0', className)}>
      <Button
        variant={selected === null ? 'secondary' : 'ghost'}
        size="sm"
        onClick={() => onSelect(null)}
        className="h-8"
      >
        All
      </Button>
      {members.map((member) => (
        <Button
          key={member.id}
          variant={selected === member.id ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => onSelect(member.id)}
          className="gap-1.5 h-8 px-2"
        >
          <UserAvatar
            name={member.name}
            imageUrl={member.avatarUrl}
            color={member.color}
            size="sm"
            className="h-5 w-5 text-[10px]"
          />
          <span className="hidden sm:inline">{member.name}</span>
        </Button>
      ))}
    </div>
  );
}
