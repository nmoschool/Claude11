export default function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  const box = size === "lg" ? "h-16 w-16 text-2xl rounded-2xl" : "h-9 w-9 text-sm rounded-lg";
  return (
    <div className={`flex items-center justify-center bg-gradient-to-br from-brand-500 to-accent-500 font-black text-white shadow ${box}`}>
      ض
    </div>
  );
}
