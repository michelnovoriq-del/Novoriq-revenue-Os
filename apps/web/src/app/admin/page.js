import { ProtectedView } from "../../components/ProtectedView";

export default function AdminPage() {
  return (
    <ProtectedView
      scope="admin"
      title="Admin control center"
      description="This area is limited to administrators and validated by the backend."
    />
  );
}
