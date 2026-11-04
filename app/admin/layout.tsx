import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "관리자 콘솔 | 이온랩 리파이너리",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
