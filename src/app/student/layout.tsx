import RegisterSW from "@/components/RegisterSW";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <RegisterSW />
      {children}
    </>
  );
}
