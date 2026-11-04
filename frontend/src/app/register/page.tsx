import { Suspense } from "react";
import type { Metadata } from "next";
import RegisterView from "@/components/views/RegisterView";

export const metadata: Metadata = {
  title: "Pendaftaran Wajah Pengguna | FaceLock Smart Classroom",
  description: "Daftarkan identitas mahasiswa dan dosen melalui pemindaian kamera biometrik.",
};

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-slate-500">Memuat modul pendaftaran...</div>}>
      <RegisterView />
    </Suspense>
  );
}
