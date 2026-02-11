import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import Image from "next/image";


export const metadata: Metadata = {
  title: "UDownload",
  description: "A platform to download content easily",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <header>
          <nav className="flex flex-row justify-between h-16 p-8 items-center">
            <Link href="/" className="font-bold flex flex-row items-center gap-2">
              <Image src="/image.svg" alt="Logo" width={40} height={40} />
              UDownload
            </Link>
            <div className="flex flex-row gap-8 items-center">
              {/* <label className="inline-flex items-center cursor-pointer border-2 border-neutral-quaternary rounded-full p-1">
                <text className="mx-2">Dark</text>
                <input type="checkbox" value="" className="sr-only peer" />
                <div className="relative w-9 h-5 bg-neutral-quaternary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-buffer after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand"></div>
              </label> */}
              <Link href="/how-to">How to</Link>
            </div>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
