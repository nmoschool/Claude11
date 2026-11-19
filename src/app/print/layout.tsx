import { requireStaffPage } from "@/lib/guard";
import PrintToolbar from "@/components/PrintToolbar";

/** قوالب الطباعة: صفحة بيضاء بمقاس A4 — نفس القالب للطباعة من المتصفح ولتوليد PDF على الخادم */
export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  await requireStaffPage();
  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      <PrintToolbar />
      <div className="print-sheet mx-auto my-6 w-[210mm] max-w-full bg-white p-[12mm] shadow print:m-0 print:w-full print:p-0 print:shadow-none">{children}</div>
    </div>
  );
}
