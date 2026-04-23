import { ProtectedView } from "../../components/ProtectedView";

export default function DashboardPage() {
  return (
    <ProtectedView
      scope="dashboard"
      title="User dashboard"
      description="Only users with active access and a valid subscription can stay here."
    />
  );
}
