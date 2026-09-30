'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/documents', label: 'Documents' },
  { href: '/upload', label: 'Upload' },
  { href: '/status', label: 'Status' },
  { href: '/inspector', label: 'Chunk inspector' },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav>
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="nav-link"
          aria-current={pathname.startsWith(link.href) ? 'page' : undefined}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
