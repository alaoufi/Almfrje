import { redirect } from 'next/navigation';

/** Canonical entry point for the Almfrje custom domain. */
export default function RootPage() {
  redirect('/almfrje/');
}
