import "./globals.css";

export const metadata = {
  title: "Novoriq Revenue OS",
  description: "Authentication foundation for the Novoriq Revenue OS."
};

export const viewport = {
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
