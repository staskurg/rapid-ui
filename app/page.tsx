import { AdminRenderer } from "@/components/admin/AdminRenderer";
import { sampleSpec, sampleData } from "@/lib/spec/sample-spec";

export default function Home() {
  return (
    <div className="container mx-auto py-8 px-4">
      <AdminRenderer spec={sampleSpec} initialData={sampleData} />
    </div>
  );
}
