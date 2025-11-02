import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'API Documentation - Icarus Game Manager',
  description: 'Interactive API documentation for the Icarus Game Manager',
};

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <link
        rel="stylesheet"
        href="https://unpkg.com/@stoplight/elements/styles.min.css"
      />
      {children}
    </>
  );
}