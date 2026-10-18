import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Productividad del servicio", template: "%s | Productividad del servicio" },
  description: "Reportería de productividad: horas trabajadas vs presupuestadas, entregas y tiempos de ciclo.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600;650;700;750&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
