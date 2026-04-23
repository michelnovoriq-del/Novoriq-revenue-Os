import "./globals.css";

export const metadata = {
  title: "Novoriq Revenue OS",
  description: "Authentication foundation for the Novoriq Revenue OS."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
