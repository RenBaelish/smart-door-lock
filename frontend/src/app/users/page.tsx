import UsersView from "@/components/views/UsersView";

export const metadata = {
  title: "Data Pengguna (Admin Dashboard) | FaceLock Smart Classroom",
  description: "Manajemen akun administrator dan operator yang memiliki hak akses ke Web Dashboard Smart Classroom.",
};

export default function UsersPage() {
  return <UsersView />;
}
